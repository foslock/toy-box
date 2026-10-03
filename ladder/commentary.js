// Ladder: the commentator. Deadpan captions for the replay of the day's worst fall, built from what happened.

const pick = (arr, seed) => arr[Math.abs(Math.floor(seed)) % arr.length];
const m1 = h => h.toFixed(1);
const words = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? String(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const nameOf = o => o ? (o.name || o) : null;

// fall: { lost, cause, bounces, foot, top, land, air, falls (that day), section }
export function caption(f, seed = 1) {
  const lost = f.lost, H = m1(lost), foot = nameOf(f.foot), top = nameOf(f.top), land = nameOf(f.land);
  const head = `Worst fall of the day: ${H} m`;
  const open = [];
  if (f.cause === 'slip') {
    open.push(foot ? `The foot of the ladder was on ${foot}. You could hear it thinking about leaving.` : `The foot went first. It usually does.`);
    if (foot && /fridge|washing|stove|bathtub/.test(foot)) open.push(`Ladder on enamel. A bold choice, and the enamel has never once been on the painter's side.`);
    if (foot && /piano/.test(foot)) open.push(`Footing on a lacquered piano. Very elegant. Very brief.`);
    open.push(`Not enough angle on it. Physics was always going to have the last word.`);
  } else if (f.cause === 'tip') {
    open.push(`Up that ladder like it owed money. Ladders do not like being hurried.`);
    open.push(`Too steep, too quick, and over it goes, backwards, like a door.`);
    open.push(`You'll see the top come off ${top || 'the support'} here. That's where the afternoon changed.`);
  } else if (f.cause === 'slide') {
    open.push(top ? `The top of the ladder simply left ${top}. No warning, no note.` : `The top of the ladder found nothing much to hold on to.`);
    open.push(`Leaned on ${top || 'something smooth'}, and something smooth leaned back.`);
  } else if (f.cause === 'hop') {
    open.push(`And this one was voluntary. Remarkable commitment.`);
    open.push(`A deliberate step off the edge. We'll call it route-finding.`);
  } else if (f.cause === 'letgo') {
    open.push(`Ran out of ladder at the bottom and decided to let go. Hard to argue with.`);
  } else {
    open.push(`Hard to say exactly what went wrong. Everything, mostly.`);
  }
  const close = [];
  if (lost > 25) close.push(`${H} metres. A lot of that was earned the slow way. All of it went back the quick way.`, `${H} metres of heap, handed back in one go.`);
  else if (lost > 10) close.push(`${H} metres. The judges will want to see that again.`, `That's ${H} metres to do again, carefully this time.`, `${H} metres, and the paint, for the record, is fine.`);
  else close.push(`${H} metres. Not the worst we've seen. Not good, either.`, `${H} metres, and a long look back up at it.`, `Only ${H} metres, but it was the day's best effort, in its way.`);
  if (f.bounces >= 3) close.push(`${cap(words(f.bounces))} separate impacts on the way down. Thorough.`);
  if (land) close.push(`Comes to rest on ${land}, which has seen all this before.`);
  if (f.air > 2.2) close.push(`${f.air.toFixed(1)} seconds in the air. No marks for style.`);
  return { head, line: pick(open, seed) + ' ' + pick(close, seed * 7 + 3) };
}

export function closer(stats) {
  if (!stats.falls) return 'Not one fall today. Nothing to show. Well climbed.';
  if (stats.falls === 1) return 'One fall all day. We showed you it anyway.';
  return `${cap(words(stats.falls))} falls today. This was the big one.`;
}
