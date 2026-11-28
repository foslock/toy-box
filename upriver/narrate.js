// The narrator. Better footage gets better narration: a great clip gets the
// full wonder, a decent one a plain line, and a bad one an honest, gentle
// account of what went wrong.
import { SPECIES } from './creatures.js';

const INTRO = {
  puffwick: 'This is the puffwick: a small, round, entirely optimistic bird, made, as far as anyone can tell, mostly of moss.',
  mossback: 'The mossback tortoise is the oldest thing in this wood. Several of the trees are, in fact, growing on it.',
  ferngrazer: 'The ferngrazer is so shy that for many years it was thought to be a fern.',
  stiltbill: 'The stiltbill stands on legs that seem to have been borrowed from something much larger.',
  reedotter: 'The reed otter spends most of its life on its back, which is, it would argue, the correct way up.',
  boomer: 'The boomer is a marsh toad with one great talent, and it is not a subtle one.',
  lampjelly: 'Lampjellies drift through the cave air like lanterns that have wandered off on their own.',
  shellcap: 'The shellcap is a crab that carries a mushroom on its back. The mushroom, in turn, carries a light.',
  hushbat: 'Hushbats hang from the ceiling by day which, down here, is always.',
  gloamer: 'The gloamer is enormous, shaggy and, for something so big, remarkably polite.',
  wisps: 'Each of these lights is a tiny beetle. Together they are called a wisp, and they seem to think as one.',
  moonmoth: 'The moonmoth is the size of a dinner plate, and nearly as pale as the moon it is named for.',
};

// [phrase, great, good]
const LINES = {
  'puffwick:preening': ['tidying its feathers',
    'Each morning the puffwick tidies every feather, one at a time. There are four thousand of them. It does not skip any.',
    'The puffwick begins its day the way we all should: by tidying up.'],
  'puffwick:singing': ['singing',
    'Whistle, and the puffwick answers. Not, I suspect, because it understands, but because it would be rude not to.',
    'A whistle from the boat, and the puffwick whistles back. A conversation, of sorts.'],
  'puffwick:chorus': ['singing with the others',
    'And here is something very few people have seen: the dawn chorus. One puffwick sings, and then all of them do, until the whole tree is singing and the mist itself seems to listen.',
    'Three puffwicks, one song. The dawn chorus is the wood’s alarm clock.'],
  'mossback:plodding': ['walking',
    'The mossback is going somewhere. It has been going there since before I was born, and it will get there, eventually.',
    'One step. A pause for thought. Another step. The mossback is never in a hurry.'],
  'mossback:feeding': ['eating',
    'A fallen fruit. For a mossback this is the event of the season. It will take all afternoon to eat, and it will enjoy every minute.',
    'The mossback eats slowly, thoroughly and with great dignity.'],
  'mossback:dozing': ['nodding off',
    'Something about the bubbles soothes it. The old tortoise’s eyes close, the little tree on its back sways, and for a while the whole hillside seems to doze.',
    'A few bubbles, and the mossback nods off. It has earned it.'],
  'ferngrazer:peeking': ['peering out of the ferns',
    'There. Between the fronds. The ferngrazer has seen us, and has decided, for now, that we are not interesting enough to run from.',
    'A pair of eyes in the ferns. The ferngrazer is watching us watching it.'],
  'ferngrazer:grazing': ['grazing in the open',
    'Coaxed out by our whistle, the ferngrazer steps into the open. It is braver than it looks, and it looks very nervous indeed.',
    'Out of cover at last, the ferngrazer grazes, one ear always on us.'],
  'ferngrazer:sparring': ['sparring',
    'Two ferngrazers, one fruit. What follows is less a fight than a very polite argument, conducted entirely with foreheads.',
    'Two young ferngrazers settle a dispute the traditional way: by bumping heads.'],
  'stiltbill:fishing': ['fishing',
    'The stiltbill waits. And waits. And then, faster than you can blink, it strikes. Breakfast.',
    'Patience is the stiltbill’s only tool, and it is a very good one.'],
  'stiltbill:gulping': ['swallowing a fruit whole',
    'The stiltbill has swallowed the fruit whole. You can follow its progress all the way down. The stiltbill looks, if anything, surprised.',
    'A fruit, swallowed whole. The stiltbill is not a fussy eater.'],
  'stiltbill:dancing': ['dancing',
    'And now, the dance. Wings out, heads bobbing, two stiltbills high-step around each other in the shallows. It is ridiculous, and it is beautiful, and it may be the most important thing either of them does all year.',
    'A stiltbill courtship dance: all elbows, all heart.'],
  'reedotter:floating': ['floating',
    'Belly up in the sun, paws folded, the reed otter drifts. It is not lazy. It is simply very, very good at resting.',
    'The reed otter floats wherever the current takes it, and the current seems happy to oblige.'],
  'reedotter:chasing': ['chasing bubbles',
    'Bubbles! The otter is off its back in an instant, diving and surfacing, trying to catch every single one. It does not catch any. It does not mind.',
    'No otter has ever caught a bubble. They keep trying.'],
  'reedotter:juggling': ['juggling',
    'This is extraordinary. The otter isn’t eating the fruit. It is juggling it. There is no reason for this at all, except, perhaps, joy.',
    'Given a fruit, the reed otter plays with it first. Lunch can wait.'],
  'boomer:basking': ['basking',
    'The boomer sits on its lily pad like a king on a very small throne, soaking up the sun.',
    'A boomer, basking. It is saving its energy for later.'],
  'boomer:booming': ['booming',
    'BOOM. The boomer’s call carries three miles across the marsh. Somewhere out there, another boomer is deeply impressed.',
    'The boomer inflates, and lets go. The reeds tremble.'],
  'boomer:ballooning': ['floating away in a bubble',
    'I have been filming wildlife for forty years, and I have never seen this. The boomer has caught a bubble, the bubble has caught the boomer, and the boomer is, for a moment, flying.',
    'A boomer, briefly airborne. It seems as surprised as we are.'],
  'lampjelly:drifting': ['drifting',
    'The lampjellies drift on air currents we cannot feel, lighting the cave in slow, soft pulses.',
    'A lampjelly drifts past, glowing gently, going nowhere in particular.'],
  'lampjelly:gathering': ['gathering round the bubbles',
    'The bubbles catch the light, and the lampjellies come to see. They gather and pulse, brighter and brighter, as if greeting a cousin.',
    'Drawn to the bubbles, the lampjellies gather and glow.'],
  'lampjelly:lightsout': ['dimming',
    'At our whistle the lampjelly dims, and sinks, and goes out. Lights out. The cave holds its breath in the dark.',
    'A whistle, and the lampjelly dims. Even down here, there is a bedtime.'],
  'shellcap:scuttling': ['scuttling',
    'Sideways, always sideways. The shellcap carries its lamp along the ledges like a night watchman on his rounds.',
    'The shellcap scuttles off on its rounds.'],
  'shellcap:snacking': ['snacking',
    'Snip, snip, snip. The shellcap eats with tiny, precise claws, like someone doing very delicate needlework with their dinner.',
    'A fruit, carefully snipped into crab-sized pieces.'],
  'shellcap:hiding': ['hiding under its mushroom',
    'Startled, the shellcap tucks itself under its mushroom, and the mushroom glows, as if to say: nobody here. Just a mushroom.',
    'Under its mushroom, the shellcap is, it believes, invisible.'],
  'hushbat:roosting': ['roosting',
    'Wrapped in its wings, the hushbat sways gently from the ceiling, dreaming whatever hushbats dream.',
    'A hushbat, hanging about. That is most of what they do.'],
  'hushbat:swirling': ['swirling through the cave',
    'Our whistle wakes the roost. The hushbats pour from the ceiling and swirl through the cave in great looping ribbons, reading the dark by sound alone.',
    'Woken by the whistle, the hushbats loop through the cave.'],
  'hushbat:catching': ['catching fruit in mid-air',
    'A fruit, tossed into the dark, and the hushbat takes it in mid-air without a sound. It knew exactly where it would be.',
    'Caught in mid-air. The hushbat does not miss.'],
  'gloamer:fishing': ['fishing',
    'The gloamer fishes by moonlight, one huge paw raised, waiting for the silver flash beneath the water.',
    'A gloamer, fishing in the shallows. It is patient, and usually lucky.'],
  'gloamer:feasting': ['eating',
    'A gift of fruit, accepted with enormous care. The gloamer eats as though it has never tasted anything so good, and perhaps it never has.',
    'The gloamer eats, slowly and happily.'],
  'gloamer:moonsong': ['singing to the moon',
    'Full and content, the gloamer sits back, lifts its great head, and sings to the moon. No one knows why. No one who has heard it has ever needed to ask.',
    'A well-fed gloamer sings, and the river seems to stop and listen.'],
  'wisps:dancing': ['dancing',
    'The wisp turns and folds over the water, a hundred tiny lights moving as one.',
    'The wisp drifts and loops above the reeds.'],
  'wisps:riding': ['riding the bubbles',
    'The beetles climb into the bubbles and ride them, so each bubble glows like a little floating lamp, until, one by one, they pop.',
    'Each bubble carries a passenger tonight.'],
  'wisps:constellation': ['making a star',
    'And then the wisp does something astonishing. At our whistle every light finds its place, and for a moment there is a new star over the river.',
    'The beetles arrange themselves into a star, hold it, and let it go.'],
  'moonmoth:resting': ['resting',
    'Folded on its reed, the moonmoth is very nearly invisible, and quite content to stay that way.',
    'A moonmoth at rest, pale as paper.'],
  'moonmoth:sipping': ['sipping fruit',
    'The moonmoth uncurls its long tongue and sips the fruit, delicately, like someone tasting a very old wine.',
    'A sip of fruit. Moonmoths have refined tastes.'],
  'moonmoth:fluttering': ['chasing bubbles',
    'The bubbles catch the moonlight, and the moonmoth follows them up, wings wide and silver, dancing with what it takes to be tiny moons.',
    'The moonmoth flutters after the bubbles.'],
};

const POOR = {
  far: ['Here, a very long way away, a {name} is {phrase}. I am told it was wonderful up close.', 'A {name}, {phrase}, in the far distance. You may need to squint.'],
  cut: ['Just at the edge of the shot, a {name} is {phrase}. Most of it, anyway.', 'Part of a {name}, {phrase}. The rest of it is just out of frame, doing the same.'],
  shaky: ['A {name}, {phrase}, filmed by a camera operator who was, I can only assume, being chased.', 'A {name}, {phrase}. Our boat, it seems, was in rough water.'],
  meh: ['A {name}, {phrase}.', 'Here, a {name} is {phrase}, more or less.'],
  glimpse: ['A glimpse of a {name}, {phrase}. Gone before we could look properly.'],
};
const EMPTY = [
  'This is the river. It is doing what rivers do.',
  'A fine stretch of bank. Nothing lives here, apparently, or nothing that wished to be filmed.',
  'Our camera operator was very taken with this patch of scenery.',
  'Here, nothing happens, beautifully.',
];
const OPEN = [
  'Dawn on the upper river. The mist has not yet decided whether to leave, and the wood is holding its breath.',
  'Downstream, the river slows and spreads into the great reed marsh. At midday everything here is gold, and everything here is hungry.',
  'Here the river goes underground. No sunlight has reached these caves for ten thousand years, so the residents have made their own.',
  'Night on the lower river. The moon is up, the water is black and silver, and the night shift has begun.',
];
const CLOSE = {
  5: 'We came to watch the river. For a few hours, it let us.',
  4: 'We came to watch the river. It showed us more than we had any right to expect.',
  3: 'The river keeps most of its secrets. Today, it shared a few.',
  2: 'The river keeps its secrets. Perhaps, next time, it will share one or two.',
  1: 'Perhaps next time the creatures will come a little closer. Or the camera will.',
};
const REVIEW = {
  5: ['Unmissable. The {name} alone is worth the licence fee.', 'Television at its gentlest and best. I wept at the {name}.'],
  4: ['Gorgeous. Stay for the {name}.', 'A handsome hour, with a scene-stealing {name}.'],
  3: ['Gentle, handsome and occasionally in focus.', 'Pleasant enough, and the {name} has its moments.'],
  2: ['Mostly scenery, but the {name} has charm.', 'A lot of river and not much else, though we liked the {name}.'],
  1: ['We are told there were animals.', 'A very long look at some water.'],
};

const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function behPhrase(sp, beh) { return (LINES[sp + ':' + beh] || [beh])[0]; }

export function writeEpisode(ri, cut, starsN, seed = 1) {
  const lines = [];
  const met = new Set(); let empty = seed % EMPTY.length; let pick = seed;
  cut.forEach((clip, i) => {
    const out = [];
    const g = clip.subject;
    if (!g) { out.push(EMPTY[empty++ % EMPTY.length]); lines.push(out); return; }
    const sp = SPECIES[g.sp]; const L = LINES[g.sp + ':' + g.beh];
    const name = lc(sp.name);
    if (!met.has(g.sp) && g.tier >= 2) out.push(INTRO[g.sp]);
    met.add(g.sp);
    if (g.tier === 3) out.push(L[1]);
    else if (g.tier === 2) out.push(L[2]);
    else {
      const pool = g.tier === 0 ? POOR.glimpse : POOR[g.defect];
      out.push(fill(pool[pick++ % pool.length], { name, phrase: L[0] }).replace(/^a ([aeiou])/i, (m, v) => (m[0] === 'A' ? 'An ' : 'an ') + v));
    }
    lines.push(out);
  });
  const best = [...cut].filter((c) => c.subject).sort((a, b) => b.score - a.score)[0];
  const bestName = best ? lc(SPECIES[best.subject.sp].name) : 'river';
  const rv = REVIEW[starsN];
  return {
    open: OPEN[ri],
    lines,
    close: CLOSE[starsN],
    review: fill(rv[seed % rv.length], { name: bestName }),
  };
}

export const fixArticle = (s) => s.replace(/\b([Aa]) ([aeiou])/g, (m, a, v) => (a === 'A' ? 'An ' : 'an ') + v);
