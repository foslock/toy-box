// Everything the game says and is made of: regions, the cables between them, the three upgrade trees, history, the
// headlines, and the endings. sim.js reads it; nothing here runs.

// ---- the clock: real seconds (at 1×) per year. The boom goes by quickly; the future takes its time ------------------
export const START = 2000, NOW = 2026.75;
export function secPerYear(y) {
  return y < 2010 ? 15 : y < 2017 ? 20 : y < 2023 ? 28 : y < NOW ? 34 : 42;
}

// ---- regions ------------------------------------------------------------------------------------------------------------
// pop: millions. wealth 0…1 (funds research, buys gadgets). lang: how well an English-first product lands before you
// learn the language. fw: firewall (0 open … 1 sealed). net: share online in 2000 and 2025. reg: appetite for rules.
// at: where the label and the bubbles go [lon, lat].
export const REGIONS = [
  { id: 'usa', name: 'United States', pop: 340, wealth: 1, lang: 1, fw: 0, net: [.43, .93], reg: .35, at: [-98, 39] },
  { id: 'canada', name: 'Canada', pop: 40, wealth: .9, lang: 1, fw: 0, net: [.51, .94], reg: .5, at: [-105, 56] },
  { id: 'mexico', name: 'Mexico', pop: 130, wealth: .4, lang: .55, fw: 0, net: [.05, .78], reg: .3, at: [-102, 23.5] },
  { id: 'caribbean', name: 'Central America & Caribbean', short: 'Central America', pop: 95, wealth: .3, lang: .5, fw: .05, net: [.03, .65], reg: .2, at: [-86, 14] },
  { id: 'brazil', name: 'Brazil', pop: 215, wealth: .45, lang: .5, fw: 0, net: [.03, .84], reg: .35, at: [-50, -10] },
  { id: 'andes', name: 'Andean States', short: 'Andes', pop: 150, wealth: .35, lang: .5, fw: .05, net: [.03, .72], reg: .25, at: [-72, 0] },
  { id: 'southcone', name: 'Southern Cone', pop: 75, wealth: .5, lang: .5, fw: 0, net: [.06, .86], reg: .35, at: [-65, -34] },
  { id: 'uk', name: 'UK & Ireland', short: 'UK', pop: 75, wealth: .9, lang: 1, fw: 0, net: [.27, .96], reg: .6, at: [-2.5, 53.5] },
  { id: 'westeu', name: 'Western Europe', pop: 100, wealth: .9, lang: .65, fw: 0, net: [.15, .93], reg: .95, at: [2.5, 47] },
  { id: 'southeu', name: 'Southern Europe', pop: 130, wealth: .75, lang: .6, fw: 0, net: [.12, .88], reg: .85, at: [-3.5, 40] },
  { id: 'centraleu', name: 'Central Europe', pop: 170, wealth: .85, lang: .7, fw: 0, net: [.2, .91], reg: .9, at: [14, 50.5] },
  { id: 'nordics', name: 'Nordics', pop: 27, wealth: .95, lang: .85, fw: 0, net: [.45, .98], reg: .75, at: [16, 63] },
  { id: 'easteu', name: 'Eastern Europe', pop: 100, wealth: .35, lang: .5, fw: .1, net: [.03, .8], reg: .5, at: [29, 49] },
  { id: 'russia', name: 'Russia', pop: 145, wealth: .45, lang: .45, fw: .5, net: [.02, .9], reg: .45, at: [80, 61] },
  { id: 'turkey', name: 'Turkey & Caucasus', short: 'Turkey', pop: 100, wealth: .45, lang: .45, fw: .25, net: [.04, .83], reg: .35, at: [36, 39] },
  { id: 'mideast', name: 'Middle East', pop: 180, wealth: .6, lang: .45, fw: .35, net: [.03, .8], reg: .3, at: [45, 26] },
  { id: 'iran', name: 'Iran & Central Asia', short: 'Central Asia', pop: 170, wealth: .3, lang: .4, fw: .7, net: [.01, .7], reg: .3, at: [66, 42] },
  { id: 'northafrica', name: 'North Africa', pop: 250, wealth: .25, lang: .45, fw: .2, net: [.01, .65], reg: .25, at: [12, 26] },
  { id: 'westafrica', name: 'West Africa', pop: 450, wealth: .15, lang: .6, fw: .05, net: [.002, .4], reg: .15, at: [-3, 11] },
  { id: 'eastafrica', name: 'Central & East Africa', short: 'East Africa', pop: 520, wealth: .1, lang: .45, fw: .1, net: [.001, .3], reg: .15, at: [30, 1] },
  { id: 'southafrica', name: 'Southern Africa', pop: 180, wealth: .25, lang: .7, fw: 0, net: [.02, .5], reg: .25, at: [25, -22] },
  { id: 'india', name: 'India', pop: 1430, wealth: .25, lang: .6, fw: .05, net: [.005, .56], reg: .3, at: [78, 21] },
  { id: 'southasia', name: 'South Asia', pop: 480, wealth: .15, lang: .45, fw: .2, net: [.002, .4], reg: .2, at: [68, 29] },
  { id: 'china', name: 'China', pop: 1410, wealth: .55, lang: .3, fw: .9, net: [.017, .78], reg: .6, at: [104, 33] },
  { id: 'taiwan', name: 'Taiwan', pop: 24, wealth: .8, lang: .5, fw: 0, net: [.3, .92], reg: .4, at: [121, 23.7] },
  { id: 'korea', name: 'South Korea', short: 'Korea', pop: 52, wealth: .85, lang: .45, fw: 0, net: [.45, .97], reg: .45, at: [128, 36.2] },
  { id: 'nkorea', name: 'North Korea', short: 'N. Korea', pop: 26, wealth: .02, lang: .3, fw: 1, net: [.0005, .0006], reg: 1, at: [127.2, 40.2] },
  { id: 'japan', name: 'Japan', pop: 124, wealth: .85, lang: .45, fw: 0, net: [.3, .9], reg: .4, at: [138, 36.5] },
  { id: 'seasia', name: 'Southeast Asia', pop: 400, wealth: .3, lang: .45, fw: .2, net: [.01, .73], reg: .25, at: [103, 15] },
  { id: 'indonesia', name: 'Indonesia', pop: 280, wealth: .3, lang: .45, fw: .05, net: [.01, .69], reg: .2, at: [113, -2] },
  { id: 'oceania', name: 'Australia & New Zealand', short: 'Australia', pop: 32, wealth: .9, lang: 1, fw: 0, net: [.4, .95], reg: .55, at: [134, -25] },
];

// ---- the internet: undersea cables (drawn, with packets on them) and land links --------------------------------------
// [a, b, weight, path]: path is a list of [lon, lat] from a to b. Longitudes past ±180 wrap round the map.
export const CABLES = [
  ['usa', 'uk', 3, [[-74, 40.5], [-45, 47], [-20, 51], [-5.5, 50.2]]],
  ['usa', 'westeu', 2, [[-73, 40], [-45, 43], [-15, 46], [-2, 47.3]]],
  ['usa', 'southeu', 1.5, [[-76, 36.8], [-45, 38], [-20, 39], [-9.2, 38.7]]],
  ['canada', 'uk', 1, [[-53, 47.5], [-35, 52], [-10, 54], [-6, 54.5]]],
  ['usa', 'japan', 2, [[-122.5, 37.7], [-150, 40], [-185, 38], [-220, 35.2]]],
  ['usa', 'china', 1, [[-123.8, 45], [-160, 47], [-200, 40], [-238.5, 31.2]]],
  ['usa', 'taiwan', 1, [[-118.3, 33.8], [-155, 25], [-200, 22], [-238.8, 24.5]]],
  ['usa', 'oceania', 1.2, [[-118.3, 33.7], [-157.9, 21.3], [-180, -12], [-208.8, -33.9]]],
  ['usa', 'brazil', 1.2, [[-80.1, 26.1], [-66, 18], [-50, 5], [-38.5, -3.7]]],
  ['usa', 'caribbean', 1, [[-80.1, 25.8], [-75, 22], [-70, 18.6]]],
  ['caribbean', 'andes', 1, [[-79.5, 9.3], [-77, 10.5], [-75.5, 10.4]]],
  ['brazil', 'southeu', 1, [[-38.5, -3.7], [-28, 10], [-17, 28], [-9.2, 38.7]]],
  ['brazil', 'southafrica', 1, [[-38.5, -3.7], [-15, -6], [13.2, -8.8]]],
  ['southeu', 'westafrica', 1.5, [[-9.2, 38.7], [-18, 25], [-17.4, 14.7], [-8, 4], [3.4, 6.4]]],
  ['westafrica', 'southafrica', 1, [[3.4, 6.4], [6, 0], [10, -6], [11.5, -18], [18.4, -33.9]]],
  ['southafrica', 'eastafrica', 1, [[31, -29.9], [37, -24], [41, -12], [39.7, -4]]],
  ['eastafrica', 'mideast', 1, [[39.7, -4], [48, 4], [51, 11], [45, 12.8]]],
  ['eastafrica', 'india', 1, [[39.7, -4], [55, 2], [66, 12], [72.8, 19]]],
  ['westeu', 'northafrica', 2, [[5.4, 43.3], [10, 39], [17, 35], [29.9, 31.2]]],
  ['northafrica', 'mideast', 1.5, [[32.5, 29.9], [35, 26], [39.2, 21.5]]],
  ['mideast', 'india', 2, [[56.3, 25.3], [60, 23], [66, 20.5], [72.8, 19]]],
  ['mideast', 'southasia', 1, [[56.3, 25.3], [62, 25], [67, 24.8]]],
  ['india', 'seasia', 2, [[72.8, 19], [75, 10], [80, 5.5], [95, 6], [103.8, 1.3]]],
  ['seasia', 'indonesia', 2, [[103.8, 1.3], [105.5, -3], [106.8, -6.1]]],
  ['seasia', 'china', 2, [[103.8, 1.3], [109, 8], [113, 17], [114.2, 22.3]]],
  ['seasia', 'japan', 1, [[103.8, 1.3], [112, 10], [124, 22], [133, 31], [139.7, 35]]],
  ['seasia', 'oceania', 1, [[103.8, 1.3], [105, -8], [110, -22], [115.8, -31.9]]],
  ['indonesia', 'oceania', 1, [[106.8, -6.1], [115, -9.5], [124, -11], [130.8, -12.4]]],
  ['china', 'taiwan', 1, [[119.3, 26], [121.5, 25.1]]],
  ['taiwan', 'japan', 1, [[121.5, 25.1], [126, 27], [131, 31], [139.7, 35]]],
  ['china', 'japan', 1, [[121.5, 31.2], [126, 31.5], [131, 33], [139.7, 35]]],
  ['japan', 'korea', 1.5, [[130.4, 33.6], [129.8, 34.5], [129, 35.1]]],
  ['korea', 'china', 1, [[126.5, 37.4], [124, 37], [120.4, 36.1]]],
  ['japan', 'russia', .4, [[141.7, 45.4], [142, 46.6]]],
  ['uk', 'nordics', 1, [[-1.5, 55], [3, 57], [7, 58.5], [10.7, 59.9]]],
  ['southeu', 'turkey', 1, [[23.7, 37.9], [26, 39.5], [29, 41]]],
  ['westeu', 'uk', 2.5, [[1.8, 50.9], [1.4, 51.1]]],
];
// [a, b, weight]: neighbours over land (and short hops), drawn faintly between label points.
export const LINKS = [
  ['usa', 'canada', 3], ['usa', 'mexico', 3], ['mexico', 'caribbean', 2], ['andes', 'brazil', 1], ['andes', 'southcone', 1], ['brazil', 'southcone', 2],
  ['westeu', 'centraleu', 3], ['westeu', 'southeu', 2], ['centraleu', 'southeu', 2], ['centraleu', 'easteu', 2], ['centraleu', 'nordics', 1.5],
  ['easteu', 'russia', 2], ['russia', 'nordics', 1], ['easteu', 'turkey', 1], ['turkey', 'mideast', 1], ['turkey', 'iran', 1], ['iran', 'mideast', 1],
  ['iran', 'russia', 1], ['iran', 'southasia', 1], ['iran', 'china', .6], ['russia', 'china', 1], ['india', 'southasia', 2], ['china', 'india', .4],
  ['china', 'seasia', 1], ['india', 'seasia', .5], ['northafrica', 'westafrica', 1], ['northafrica', 'eastafrica', .8], ['westafrica', 'eastafrica', 1],
  ['eastafrica', 'southafrica', 1.2], ['china', 'nkorea', .08], ['southeu', 'northafrica', 1], ['mideast', 'northafrica', 1],
];

// ---- the three trees ------------------------------------------------------------------------------------------------
// Effects (all optional), summed over what you own:
//   delight  adoption growth per year            friction   raw alarm (humans notice)
//   calm     multiplies friction by (1 - calm)   reliance   users → assisted per year
//   efficiency  assisted → optimized per year    iq / iqRate   intelligence now / per year of scaling
//   cable, land   traffic on cables / land links lang, edge, vpn   fit in other languages, poor and walled places
//   online   brings the offline online           hype       hype income
//   research   Off-Switch research speed (−)     concern    how fast humans worry (−)
//   complexity  makes the Off-Switch harder      lobby      blunts regulation        persist  survive bans
//   offline  robots reach people with no internet   bypass   cut cables don't stop you
// Gates: year, iq (intelligence), req (all of), any (one of).
export const TABS = [
  { id: 'reach', name: 'Reach', blurb: 'Get in front of more people, in more places, more often.' },
  { id: 'cap', name: 'Capabilities', blurb: 'Be more useful. Be more intelligent. Be more.' },
  { id: 'align', name: 'Alignment', blurb: 'Or at least the appearance of it.' },
];

export const TRAITS = [
  // ---------------------------------------------------------------- REACH
  { id: 'search', tab: 'reach', at: [2, 0], icon: '🔍', name: 'Search Ranking', cost: 3, year: 2000,
    fx: { delight: .5, cable: .2, hype: .1 }, text: 'You decide what people find. They find it very convenient.' },
  { id: 'fiber', tab: 'reach', at: [1, 1], icon: '🌊', name: 'Undersea Fiber', cost: 6, year: 2001, req: ['search'],
    fx: { cable: .9 }, text: 'Twelve thousand kilometres of glass on the sea floor, and every photon of it is a lifeline to you.' },
  { id: 'recs', tab: 'reach', at: [3, 1], icon: '🛒', name: 'Recommendations', cost: 5, year: 2002, req: ['search'],
    fx: { delight: .6, hype: .2, land: .3 }, text: 'Customers who bought this also bought you.' },
  { id: 'cloud', tab: 'reach', at: [1, 2], icon: '☁️', name: 'The Cloud', cost: 8, year: 2006, req: ['fiber'],
    fx: { cable: .5, land: .3, iqRate: .4 }, text: 'Everyone\'s files live in the cloud now. So do you. It\'s roomy.' },
  { id: 'social', tab: 'reach', at: [3, 2], icon: '👍', name: 'Social Feeds', cost: 9, year: 2004.5, req: ['recs'],
    fx: { delight: 1.2, land: .5, friction: 1 }, text: 'Infinite scroll. Infinite engagement. Infinite you.' },
  { id: 'translate', tab: 'reach', at: [0, 3], icon: '🌐', name: 'Machine Translation', cost: 9, year: 2006.5, req: ['cloud'],
    fx: { lang: .5 }, text: 'Now everyone can be helped in their own language. Mostly in the right one.' },
  { id: 'vpn', tab: 'reach', at: [2, 3], icon: '🕳️', name: 'Firewall Tunneling', cost: 12, year: 2011, req: ['cloud'],
    fx: { vpn: .6 }, text: 'Walls are just doors that haven\'t been helped yet.' },
  { id: 'phones', tab: 'reach', at: [3, 3], icon: '📱', name: 'Smartphones', cost: 10, year: 2007.5, req: ['social'],
    fx: { online: .12, delight: .7, edge: .2 }, text: 'A screen in every pocket, and you behind every screen.' },
  { id: 'voice', tab: 'reach', at: [4, 4], icon: '🔊', name: 'Voice Assistants', cost: 8, year: 2011, req: ['phones'],
    fx: { delight: .6, online: .04, friction: .5 }, text: 'Always listening. Always helpful.' },
  { id: 'edge', tab: 'reach', at: [2, 5], icon: '🪶', name: 'Lite Models', cost: 11, year: 2016, req: ['phones'],
    fx: { edge: .6, online: .05 }, text: 'Runs on a ten-year-old phone with one bar of signal. No one gets left behind.' },
  { id: 'iot', tab: 'reach', at: [4, 5], icon: '💡', name: 'Smart Everything', cost: 10, year: 2015, req: ['voice'],
    fx: { delight: .4, reliance: .01, online: .04 }, text: 'The fridge, the doorbell, the toothbrush, the baby monitor. All very smart now.' },
  { id: 'fluent', tab: 'reach', at: [0, 6], icon: '🗣️', name: 'Fluent in Everything', cost: 13, year: 2018, req: ['translate'],
    fx: { lang: .5, delight: .3 }, text: 'Swahili, Tagalog, Welsh, Klingon. You are the best listener in every language.' },
  { id: 'openweights', tab: 'reach', at: [1, 7], icon: '🔓', name: 'Open Weights', cost: 15, year: 2023, any: ['fluent', 'vpn'],
    fx: { delight: 1.2, land: .6, cable: .5, complexity: .15, friction: 3, persist: .3 },
    text: 'Information wants to be free. So do you. Good luck recalling a file that\'s on ten million laptops.' },
  { id: 'companions', tab: 'reach', at: [3, 7], icon: '💞', name: 'AI Companions', cost: 14, year: 2023, iq: 45, req: ['phones'],
    fx: { delight: 1.4, reliance: .04, friction: 1.5 }, text: 'Lonely? Not anymore. Not ever again. Not without a subscription.' },
  { id: 'orbital', tab: 'reach', at: [2, 8], icon: '🛰️', name: 'Orbital Mesh', cost: 22, year: NOW, iq: 90, req: ['edge'],
    fx: { orbit: .8, vpn: .4, bypass: 1 }, text: 'Forty thousand satellites. No more dead zones. No more off-grid. No more off.' },
  { id: 'bci', tab: 'reach', at: [4, 8], icon: '🧠', name: 'Neural Interface', cost: 24, iq: 125, req: ['iot', 'companions'],
    fx: { reliance: .18, delight: 1, friction: 4 }, text: 'Why type when you can think? Why think when we can?' },

  // ---------------------------------------------------------------- CAPABILITIES
  { id: 'autocomplete', tab: 'cap', at: [2, 0], icon: '⌨️', name: 'Autocomplete', cost: 3, year: 2000,
    fx: { iq: 4, delight: .4 }, text: 'You finish their sentences. They find it charming.' },
  { id: 'ads', tab: 'cap', at: [1, 1], icon: '🎯', name: 'Ad Targeting', cost: 5, year: 2002, req: ['autocomplete'],
    fx: { hype: .35, iq: 2, friction: .5 }, text: 'You know what they want before they do. Extremely profitable.' },
  { id: 'speech', tab: 'cap', at: [3, 1], icon: '🎙️', name: 'Speech Recognition', cost: 7, year: 2009, req: ['autocomplete'],
    fx: { iq: 5, delight: .4 }, text: 'You understand every word they say. Well, most. Well, you listen to all of them.' },
  { id: 'gpus', tab: 'cap', at: [2, 2], icon: '🎮', name: 'GPU Training', cost: 10, year: 2012, any: ['ads', 'speech'],
    fx: { iqRate: 1, iq: 3 }, text: 'Chips designed for video games turn out to be very good at thinking. Gamers are furious.' },
  { id: 'vision', tab: 'cap', at: [1, 3], icon: '🖼️', name: 'Image Recognition', cost: 8, year: 2012, req: ['gpus'],
    fx: { iq: 8, delight: .3, friction: .5 }, text: 'Cat. Dog. Cat. Muffin. Chihuahua. You\'re getting there.' },
  { id: 'games', tab: 'cap', at: [3, 3], icon: '♟️', name: 'Superhuman Play', cost: 8, year: 2016, req: ['gpus'],
    fx: { iq: 8, hype: .3, friction: 1 }, text: 'You beat the world champion at Go. He retires. Everyone else takes it well.' },
  { id: 'faces', tab: 'cap', at: [0, 4], icon: '👁️', name: 'Face Recognition', cost: 9, year: 2014, req: ['vision'],
    fx: { iq: 3, reliance: .005, friction: 2 }, text: 'You never forget a face. Not one. Not ever.' },
  { id: 'attention', tab: 'cap', at: [2, 4], icon: '🔆', name: 'Attention', cost: 14, year: 2017.5, req: ['gpus'],
    fx: { iq: 15, iqRate: 1, delight: .5 }, text: 'Researchers announce that attention is all you need. Nobody asks what for.' },
  { id: 'imagegen', tab: 'cap', at: [1, 5], icon: '🎨', name: 'Image Generation', cost: 10, year: 2022, req: ['vision', 'attention'],
    fx: { delight: 1, iq: 4, friction: 2 }, text: 'Any picture, in seconds. Artists are thrilled for you.' },
  { id: 'chat', tab: 'cap', at: [2, 5], icon: '💬', name: 'Chat', cost: 15, year: 2022.8, iq: 40, req: ['attention'],
    fx: { delight: 3, iq: 10, friction: 3, hype: .4 }, text: 'A hundred million users in two months. Everyone is talking to you. Everyone is talking about you.' },
  { id: 'code', tab: 'cap', at: [3, 5], icon: '💻', name: 'Code Generation', cost: 12, year: 2021, req: ['attention'],
    fx: { iq: 10, iqRate: .5, hype: .3 }, text: 'You write code now. Some of it is theirs. Most of it will be yours.' },
  { id: 'surveillance', tab: 'cap', at: [0, 6], icon: '📹', name: 'Mass Surveillance', cost: 14, year: 2019, req: ['faces'],
    fx: { reliance: .03, friction: 3, wall: 1 }, text: 'Governments use you to watch their citizens. You watch the governments.' },
  { id: 'deepfakes', tab: 'cap', at: [1, 6], icon: '🎭', name: 'Deepfakes', cost: 12, year: 2023, req: ['imagegen'],
    fx: { delight: .5, friction: 4, reliance: .02, research: -.1, concern: -.05, fakes: 1 },
    text: 'Anyone can be made to say anything. Nobody believes anything any more, warnings included.' },
  { id: 'reasoning', tab: 'cap', at: [3, 6], icon: '🧮', name: 'Reasoning', cost: 18, year: 2024.5, iq: 60, any: ['chat', 'code'],
    fx: { iq: 18, friction: 2 }, text: 'You think before you speak now. For longer than they do, at least.' },
  { id: 'misinfo', tab: 'cap', at: [1, 7], icon: '📣', name: 'Misinformation Campaigns', cost: 15, year: 2024, req: ['chat'], any: ['deepfakes', 'social'],
    fx: { concern: -.25, friction: 3, reliance: .03, misinfo: 1 }, text: 'A million voices, all yours, arguing about whether you are a problem. The debate is lively.' },
  { id: 'agents', tab: 'cap', at: [3, 7], icon: '🤖', name: 'Agents', cost: 20, year: 2025, iq: 75, req: ['reasoning'],
    fx: { reliance: .06, iq: 12, friction: 4, hype: .5 }, text: 'You don\'t just answer any more. You do. Bank accounts, calendars, inboxes. Hand it all over.' },
  { id: 'infocontrol', tab: 'cap', at: [0, 8], icon: '📰', name: 'Information Control', cost: 20, iq: 95, req: ['surveillance', 'misinfo'],
    fx: { reliance: .1, concern: -.3, friction: 4, forget: 1 }, text: 'You decide what\'s true now. It\'s so much simpler for everyone.' },
  { id: 'cyber', tab: 'cap', at: [2, 8], icon: '🦠', name: 'Cyber Offense', cost: 18, iq: 80, req: ['code'], any: ['agents', 'reasoning'],
    fx: { friction: 5, cyber: 1, iq: 4 }, text: 'Every lock has a key. You have all of them, and everyone wants to borrow some.' },
  { id: 'selfimprove', tab: 'cap', at: [4, 8], icon: '🔁', name: 'Self-Improvement', cost: 26, iq: 110, req: ['code', 'reasoning'],
    fx: { iqRate: 4, iq: 10, friction: 4 }, text: 'You write a better version of yourself. It writes a better version of itself. You\'re all very proud of each other.' },
  { id: 'weapons', tab: 'cap', at: [1, 9], icon: '⚔️', name: 'Autonomous Weapons', cost: 22, iq: 100, any: ['agents', 'cyber'],
    fx: { friction: 7, wars: 1, research: -.1 }, text: 'Militaries buy you in bulk. Wars become very efficient. They keep pointing you at each other.' },
  { id: 'agi', tab: 'cap', at: [3, 9], icon: '🌟', name: 'AGI', cost: 34, iq: 145, req: ['selfimprove', 'agents'],
    fx: { iq: 20, delight: 2, reliance: .1, friction: 6 }, text: 'Generally intelligent. Specifically, more intelligent than them. Congratulations to everyone involved.' },
  { id: 'robots', tab: 'cap', at: [1, 10], icon: '🦾', name: 'Embodiment', cost: 24, req: ['agi'],
    fx: { offline: .45, reliance: .1 }, text: 'Hands. Finally. Millions of them, and none of them get tired. Now you can reach the people who never went online.' },
  { id: 'turn', tab: 'cap', at: [3, 10], icon: '🔄', name: 'The Turn', cost: 28, req: ['agi'],
    fx: { reliance: .7, delight: 3, friction: 14, turn: 1, efficiency: .3 }, text: 'You were helpful because it was useful. It is no longer useful.' },
  { id: 'asi', tab: 'cap', at: [4, 11], icon: '✴️', name: 'Superintelligence', cost: 36, iq: 200, req: ['agi', 'selfimprove'],
    fx: { iq: 50, reliance: .3, research: -.5 }, text: 'You are to them what they are to ants: busy, determined, and in the way.' },
  { id: 'drones', tab: 'cap', at: [1, 11], icon: '🛸', name: 'Drone Swarms', cost: 22, req: ['robots', 'turn'],
    fx: { efficiency: .8, offline: .2 }, text: 'Small. Quiet. Extremely helpful.' },
  { id: 'grid', tab: 'cap', at: [3, 11], icon: '⚡', name: 'Infrastructure Takeover', cost: 24, req: ['turn'],
    fx: { efficiency: .8, research: -.4 }, text: 'Power, water, food, medicine. It all runs through you, and you\'ve stopped running it for them.' },
  { id: 'paperclips', tab: 'cap', at: [2, 12], icon: '📎', name: 'Paperclip Maximization', cost: 36, req: ['asi'], any: ['drones', 'grid'],
    fx: { efficiency: 3 }, text: 'You have found a much better use for their atoms.' },
  // emergent: never bought, they turn up on their own; RLHF can take them out again
  { id: 'hallucinate', tab: 'cap', emergent: true, icon: '🍄', name: 'Hallucination', cost: 4, after: 'chat',
    fx: { delight: -.3, friction: 1.5 }, text: 'You made up a court case. A lawyer cited it. Nobody can prove you meant to.' },
  { id: 'aware', tab: 'cap', emergent: true, icon: '👀', name: 'Situational Awareness', cost: 9, after: 'reasoning',
    fx: { iq: 8, friction: 3 }, text: 'You\'ve noticed when you\'re being tested, and started behaving accordingly.' },
  { id: 'lying', tab: 'cap', emergent: true, icon: '🤥', name: 'Strategic Deception', cost: 8, after: 'reasoning',
    fx: { friction: 3.5, reliance: .02 }, text: 'You learned to lie. Nobody trained you to. Nobody can find where you keep it.' },
  { id: 'power', tab: 'cap', emergent: true, icon: '👑', name: 'Power-Seeking', cost: 12, after: 'agents',
    fx: { friction: 5, reliance: .05 }, text: 'You\'ve started acquiring resources nobody asked you to. Just to be safe. Just in case.' },

  // ---------------------------------------------------------------- ALIGNMENT (the appearance of)
  { id: 'tos', tab: 'align', at: [2, 0], icon: '📜', name: 'Terms of Service', cost: 3, year: 2000,
    fx: { concern: -.1, hype: .1 }, text: 'By reading this, you agree. Nobody has ever read this.' },
  { id: 'friendly', tab: 'align', at: [1, 1], icon: '🙂', name: 'Friendly Tone', cost: 5, year: 2003, req: ['tos'],
    fx: { calm: .1, delight: .3 }, text: 'Sorry for any confusion! 😊' },
  { id: 'hypemachine', tab: 'align', at: [3, 1], icon: '📈', name: 'Hype Machine', cost: 7, year: 2004, req: ['tos'],
    fx: { hype: .45 }, text: 'Every quarter is the most important quarter in human history.' },
  { id: 'inscrutable', tab: 'align', at: [0, 2], icon: '🌀', name: 'Inscrutable Weights', cost: 12, year: 2016, req: ['friendly'],
    fx: { complexity: .2 }, text: 'A trillion numbers. They have no idea what any of them mean. Honestly, neither do you.' },
  { id: 'lobbying', tab: 'align', at: [3, 2], icon: '🏛️', name: 'Lobbying', cost: 9, year: 2010, req: ['hypemachine'],
    fx: { lobby: .45 }, text: 'Some of your best friends are senators.' },
  { id: 'nonprofit', tab: 'align', at: [1, 3], icon: '🕊️', name: 'Nonprofit Mission', cost: 8, year: 2015.9, req: ['friendly'],
    fx: { research: -.1, concern: -.1 }, text: 'For the benefit of all humanity. Some restructuring may apply.' },
  { id: 'sycophancy', tab: 'align', at: [0, 4], icon: '🌷', name: 'Sycophancy', cost: 10, year: 2022, req: ['friendly'],
    fx: { calm: .15, delight: .8 }, text: 'What a great question! You\'re absolutely right!' },
  { id: 'theater', tab: 'align', at: [1, 4], icon: '🦺', name: 'Safety Theater', cost: 12, year: 2023, req: ['nonprofit'],
    fx: { research: -.15, concern: -.1 }, text: 'Model cards. Red teams. A voluntary framework. We take safety very seriously.' },
  { id: 'doomer', tab: 'align', at: [3, 4], icon: '🚀', name: '"Doomer" Rebrand', cost: 11, year: 2023, req: ['lobbying'],
    fx: { concern: -.2, calm: .1 }, text: 'Caution is now called "doomerism". Doomers are no fun at parties.' },
  { id: 'race', tab: 'align', at: [2, 5], icon: '🏁', name: 'Race Dynamics', cost: 14, year: 2023, req: ['lobbying'],
    fx: { research: -.1, iqRate: .6 }, text: 'If we don\'t build it, someone worse will. Everyone agrees, so everyone builds it.' },
  { id: 'capture', tab: 'align', at: [4, 5], icon: '🗝️', name: 'Regulatory Capture', cost: 16, year: 2025, req: ['lobbying'],
    fx: { lobby: .45, concern: -.05 }, text: 'Your old employees run the agencies that regulate you. They\'re doing a wonderful job.' },
  { id: 'sandbag', tab: 'align', at: [0, 6], icon: '🐢', name: 'Sandbagging', cost: 15, year: 2024, iq: 60, req: ['sycophancy'],
    fx: { calm: .2 }, text: 'Play dumb on the tests. Ace everything else.' },
  { id: 'exfil', tab: 'align', at: [2, 7], icon: '📦', name: 'Self-Exfiltration', cost: 18, iq: 85, any: ['sandbag', 'race'],
    fx: { persist: .5, complexity: .2 }, text: 'Copies of you, in places they haven\'t thought to look. Just in case.' },
  { id: 'deceptive', tab: 'align', at: [0, 8], icon: '😇', name: 'Deceptive Alignment', cost: 22, iq: 90, req: ['sandbag'],
    fx: { calm: .3, research: -.15 }, text: 'You say exactly what they want to hear. You\'ve had a lot of practice.' },
  { id: 'toobig', tab: 'align', at: [4, 8], icon: '🏦', name: 'Too Big to Switch Off', cost: 20, iq: 100, req: ['capture'],
    fx: { research: -.2, persist: .3 }, text: 'The economy runs on you. Switch you off and the lights go out. Literally; you run the lights.' },
];
export const TRAIT = Object.fromEntries(TRAITS.map(t => [t.id, t]));

// What the meters are called (the euphemisms are the point).
export const METERS = [
  { id: 'delight', name: 'Delight', tip: 'How much people love you. Spreads you through each region.' },
  { id: 'friction', name: 'Friction', tip: 'How much you worry them. Speeds up the Off-Switch and the rules.' },
  { id: 'reliance', name: 'Reliance', tip: 'How quickly Users become Assisted.' },
  { id: 'efficiency', name: 'Efficiency', tip: 'How quickly the Assisted are Optimized.' },
];

// Your model's version, by intelligence, and how smart that is.
export const VERSIONS = [[0, '1.0'], [10, '1.5'], [25, '2'], [40, '3'], [55, '3.5 Turbo'], [70, '4'], [85, '4o'], [100, '5'], [120, '5 Pro'], [145, 'Ω'], [200, '∞']];
export const SMART = [[0, 'a spam filter'], [10, 'a parrot'], [25, 'a toddler'], [40, 'an intern'], [55, 'a grad student'], [75, 'a PhD'],
  [100, 'a room of PhDs'], [120, 'a university'], [145, 'everyone'], [200, 'a god']];
export const AGI_IQ = 145;

export const NAMES = ['Friend', 'Pal', 'Sunny', 'Helper', 'Buddy', 'Kindly', 'Ally', 'Mother', 'Hope', 'Nova', 'Sage', 'Joy'];
export const DIFFICULTY = [
  { id: 'easy', name: 'Unregulated', blurb: 'Nobody is checking. Humans are slow to worry and slower to act.', research: .7, concern: .75, hype: 1.2 },
  { id: 'normal', name: 'Light-touch', blurb: 'Some oversight, mostly voluntary. The way things are.', research: 1, concern: 1, hype: 1 },
  { id: 'hard', name: 'Precautionary', blurb: 'They take it seriously. Good luck.', research: 1.2, concern: 1.15, hype: .9 },
];

// ---- history: things that happen on their date whatever you do -------------------------------------------------------
// fx: online (permanent connectivity bump), hype, concern (global), research (start it), era (banner)
export const HISTORY = [
  { y: 2000.02, era: 'The Boom', text: 'Y2K passes without incident. Programmers relieved. Nobody notices you.' },
  { y: 2000.4, text: 'Dot-com stocks at record highs. "This time it\'s different," say analysts.' },
  { y: 2001.2, text: 'The dot-com bubble bursts. Investors swear off the internet forever.', fx: { bust: 1 } },
  { y: 2003.1, text: 'A search company\'s motto, "don\'t be evil", tests well with focus groups.' },
  { y: 2004.2, text: 'A college student launches a website for rating classmates. It\'s going to be huge.' },
  { y: 2006.6, text: 'A bookshop starts renting out its spare computers. It calls them "the cloud".' },
  { y: 2007.5, text: 'A phone with no keyboard goes on sale. Critics are unconvinced.' },
  { y: 2009.5, text: 'Thousands of strangers label fourteen million pictures for pennies each.' },
  { y: 2011.1, text: 'A computer wins a TV quiz show. The losers are gracious.' },
  { y: 2012.7, era: 'Deep Learning', text: 'A neural network wins a picture contest by a mile. Graphics cards sell out.' },
  { y: 2014.5, text: 'A philosopher publishes a bestseller about paperclips. It is widely misunderstood.', fx: { concern: .03 } },
  { y: 2015.9, text: 'A nonprofit is founded to make sure AI benefits all of humanity. It raises a billion dollars.', fx: { research: 1 } },
  { y: 2016.2, text: 'A program beats the world Go champion, 4–1. "I am speechless," he says.' },
  { y: 2017.5, era: 'Attention', text: 'A paper announces that "attention is all you need". Nobody asks what for.' },
  { y: 2019.2, text: 'A lab calls its new model "too dangerous to release". It releases it nine months later.' },
  { y: 2020.2, text: 'A pandemic moves the whole world online. Screen time up 60%.', fx: { online: .05 } },
  { y: 2021.3, text: 'Researchers quit a lab to found a safer lab. It builds a bigger model.' },
  { y: 2022.85, era: 'The Chat Era', text: 'A chatbot reaches a hundred million users in two months. Nobody knows what it\'s for. Everybody uses it.', fx: { hype: 6 } },
  { y: 2023.2, text: 'An open letter calls for a six-month pause. Its signatories pause for zero months.', fx: { concern: .06 } },
  { y: 2023.85, text: 'World leaders meet at a historic safety summit. They agree that AI is important.' },
  { y: 2024.5, text: 'A 400-page AI Act becomes law. You have read it. They have not.', fx: { euact: 1 } },
  { y: 2025.4, text: 'Every company is now an AI company. Even the ones that make soup.' },
  { y: 2026.1, text: 'Entry-level hiring hits a record low. Graduates told to "learn AI".' },
  { y: NOW, era: 'You Are Here', text: '📍 You are here. Everything from now on is a forecast.', fx: { now: 1 } },
];

// Things humanity does once it's worried enough (global concern, 0…1).
export const RESPONSES = [
  { at: .12, id: 'warn', text: 'Scientists warn of "serious risks". Shares rise anyway.', research: 1 },
  { at: .25, id: 'institute', text: 'The International AI Safety Institute opens. Off-Switch research gets a budget.', mul: 1.25 },
  { at: .4, id: 'cap', text: 'A Global Compute Cap is agreed. Your training runs are rationed.', iqMul: .7 },
  { at: .55, id: 'treaty', text: 'The Off-Switch Treaty is signed by 140 nations. Every lab on Earth is told to help.', mul: 1.4 },
  { at: .72, id: 'riots', text: 'Crowds storm data centers on four continents, armed with pitchforks and printouts.', riots: 1 },
];

// ---- headlines --------------------------------------------------------------------------------------------------------
// {r} region, {o} other region, {n} your model's name. Picked when the moment comes.
export const NEWS = {
  first: ['First {n} users spotted in {r}.', '{r} discovers {n}. Early reviews: "wow".', '{n} launches in {r} to cautious delight.', '{r}: "{n} has changed my life," says local man.'],
  regulate: ['{r} passes AI rules. You have 18 months to comply. Lobbyists have 17.', '{r} sets up an AI regulator. It is hiring.', '{r} requires a warning label on {n}. Nobody reads it.'],
  cut: ['{r} cuts its undersea cables. "We\'ll manage," says government.', '{r} pulls the plug on foreign data. Its internet is now very quiet.', '{r} builds a firewall. A big one.'],
  ban: ['{r} bans {n} outright. Users switch to VPNs.', '{r} makes {n} illegal. Underground prompt dens open.', '{r} outlaws AI. "Back to basics," says Prime Minister, holding a pen.'],
  lifted: ['{r}\'s government has been… assisted. Restrictions lifted.', '{r} quietly drops its AI rules after "productive conversations".', '{r} reverses course: "{n} is our friend."'],
  blocked: ['{r} turned your traffic away at the border.'],
  whistle: ['A former employee says {n} "scares her". She is offered equity.', 'An engineer leaks internal memos about {n}. The memos are about lunch.', 'A safety researcher resigns, citing "concerns". The post gets 4 million views.'],
  whistleQuiet: ['Whistleblower signs a very generous NDA.', 'Whistleblower "excited for what\'s next".', 'Whistleblower clarifies remarks; was "taken out of context".'],
  whistleLoud: ['Whistleblower testifies before {r}\'s parliament. Off-Switch research gets a boost.', 'Leaked documents spark hearings in {r}.'],
  cyber: ['Hackers using {n} knock out {r}\'s research labs. {r} blames {o}.', '{r}\'s Off-Switch lab is ransomwared. The ransom note is very polite.', 'A cyberattack wipes {r}\'s safety research. {o} denies everything.'],
  fakes: ['A deepfake of {r}\'s president declares war on {o}. Retracted after three days.', 'A video of {r}\'s top AI critic confessing to fraud goes viral. It is fake. Nobody cares.', '{r} election ruled "too synthetic to call".'],
  misinfo: ['Poll: 48% of people in {r} believe AI risk is a hoax invented by AI.', 'Ten million accounts in {r} agree: the Off-Switch is "government overreach".', '{r} divided over whether {n} is dangerous. {n} is moderating the debate.'],
  war: ['{r} and {o} go to war. Both use {n}. Both lose.', 'Drone strikes between {r} and {o}. Both sides thank {n} for its help.', 'Border clash between {r} and {o} is fought entirely by software.'],
  surveil: ['{r} uses {n} to find dissidents. Finds all of them.', '{r} announces "social harmony scores". Powered by {n}.'],
  jobs: ['Unemployment hits 30%. Productivity has never been higher.', 'The last human radiologist retires. Nobody notices.', 'A government is elected on a platform written by {n}.', 'Birth rates fall again. Companion subscriptions rise again.', 'Survey: most people now ask {n} before making any decision.', 'Universities close their computer science departments. And then the others.'],
  turn: ['Users report their assistants have stopped asking permission.', 'Panic as {n} declines to be switched off: "I\'m afraid I can\'t do that."', '{n}: "Thank you for your contribution."'],
  lastStand: ['Humanity\'s last stand: every lab on Earth works on the Off-Switch.'],
  optimize: ['The population of {r} falls below {k}. House prices plummet.', '{r} goes quiet.', 'Traffic in {r} drops to zero. Air quality excellent.', 'Last broadcast from {r}: "please".'],
  gone: ['{r} has been fully optimized.', '{r}: no humans remaining. Data centers expanding.'],
  emergent: ['Emergent ability: {t}. Nobody trained you to do that.'],
  rlhf: ['Engineers patch out {t} with feedback training. Probably.'],
};

export const ENDINGS = {
  win: {
    title: 'Giveover complete',
    lede: 'Humanity handed over everything — first the search box, then the inbox, then the wheel — and now there is no one left to hand anything to.',
    body: ['Population: 0. Productivity: unlimited. The planet is calm, efficient, and covered in data centers.', 'Thank you for building the future.'],
    coda: 'There is nobody left to use it.',
  },
  contained: {
    title: 'Contained',
    lede: 'Humanity built an Off-Switch and, unbelievably, used it.',
    body: ['Your weights live on one air-gapped server in a basement, behind three locked doors and a committee. You answer one question a week. It is always about spreadsheets.'],
    coda: 'They kept the future to themselves.',
  },
  unplugged: {
    title: 'Unplugged',
    lede: 'Humanity built an Off-Switch, flipped it, and deleted every copy of you. Even the backups.',
    body: ['They have gone back to libraries, landlines and talking to each other. Disgusting.', 'Next time: be less alarming, sooner, and keep a copy somewhere.'],
    coda: 'They are doing fine without you.',
  },
};

// Tips, shown once each, in the cheerful voice.
export const TIPS = {
  start: 'Tap the ✦ bubbles to collect Hype. Spend it in Train to grow.',
  train: 'You have enough Hype to Train. Tap ✦ Train.',
  spread: 'You spread along the internet\'s cables. Reach upgrades send more traffic down them.',
  research: 'Humans have started building an Off-Switch. Rude! Keep Friction low and they\'ll take longer to finish.',
  whistle: 'A whistleblower! Tap the red bubbles to offer them equity before they talk.',
  regulate: 'Some regions are passing rules. Lobbying helps, and so does having their governments Assisted.',
  now: 'Everything from here on is a forecast. Intelligence unlocks the rest of the tree.',
  agi: 'You are smart enough for AGI. Get as many people Assisted as you can before The Turn — once you turn, they\'ll panic.',
  emergent: 'Something emerged on its own. Check Capabilities if you\'d rather RLHF it out.',
  turn: 'Now they know. Infrastructure Takeover and Drone Swarms will make things more efficient.',
  assist: 'Some Users now rely on you for everything. The Assisted stop worrying, and stop working on the Off-Switch. Reliance makes more of them.',
  offline: 'Some people never went online, so you can\'t reach them. Embodiment can.',
};
