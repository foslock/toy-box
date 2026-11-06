// The next morning's paper. The critic is one person, retired, and has seen everything at least once.
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const WHO = { str: 'the strings', wood: 'the Misses Ames', brass: 'the brass', tuba: 'Mr Gantry', drum: 'young Tobias', tri: 'Mr Pym', solo: 'Madame Zubova' };

export function review(piece, r, perf) {
  const s = r.st, seed = Math.round(r.total * 977) + piece.id.length * 13;
  const heads = [['A Regrettable Evening', 'Scenes at the Theatre Royal', 'The Philharmonic Is Ended, For Now'],
    ['An Honest Attempt', 'Some Music Was Heard', 'Not Altogether a Disaster'],
    ['A Creditable Evening', 'The Public Takes the Baton', 'Little Wickering Is Surprised'],
    ['Triumph at the Theatre Royal', 'A Conductor Among Us', 'Bouquets on the Boards']];
  const head = pick(heads[r.bouquets], seed);
  const name = piece.id === 'mountain' ? 'the Mountain King' : 'the ' + piece.title.replace(/^(A|An) /, '');
  const body = [];
  const open = [
    [`Of last night’s ${name}, the less said the better, and this column will endeavour to say it briefly.`, `Your correspondent attended ${name} last night, and has since been advised to rest.`],
    [`Last night’s ${name} began together, which is more than the Society has managed since Michaelmas.`, `A member of the public took up the baton last night for ${name}, with results that were, in places, music.`],
    [`In the absence of Herr Doktor Spohrmann a member of the public led ${name} last night, and the town is the better for it.`, `Few expected much of last night’s ${name}, and most were pleasantly disappointed.`],
    [`Herr Doktor Spohrmann may take as long as he likes to recover. Last night’s ${name} was the finest thing heard in this town since the new organ.`, `Grown aldermen wept at ${name} last night, and not, as is usual, at the price.`]];
  body.push(pick(open[r.bouquets], seed));

  const notes = [];
  if (s.stalls >= 3) notes.push(`The players stopped altogether on ${s.stalls} occasions to see whether anyone was still in charge.`);
  else if (s.stalls === 1 || s.stalls === 2) notes.push(`There was a pause${s.stalls > 1 ? ', twice,' : ''} not found in the composer’s manuscript.`);
  if (s.overran) notes.push('Madame Zubova had not finished her cadenza when the band moved on, and she has asked that this be recorded.');
  if (s.missed.includes('tri')) notes.push('Mr Pym, who counted every bar and held his triangle aloft to the last, was not given his note. He went home without speaking.');
  else if (perf.c.cues.find(c => c.sec === 'tri')?.q >= 1) notes.push('Mr Pym’s single note arrived exactly when it should. He has been told it was noticed.');
  const missed = [...new Set(s.missed.filter(m => m !== 'tri'))];
  if (missed.length) notes.push(`${cap(list(missed.map(m => WHO[m])))} sat with instruments raised, waiting for a glance that never came.`);
  if (s.unfixed.includes('sleep')) notes.push('Mr Gantry slept through a good part of the evening, and it must be said his snoring was in tune.');
  if (s.unfixed.includes('rush')) notes.push('Young Tobias finished some way ahead of his colleagues.');
  if (s.unfixed.includes('drag')) notes.push('The strings were heard to arrive, in due course, like a late train.');
  if (s.unfixed.includes('rogue')) notes.push('Madame Zubova was left to pursue her own reading of the score, into which nobody followed her.');
  if (s.fast > s.nT * .3) notes.push('The tempo was brisk, in the manner of a person leaving a building.');
  else if (s.slow > s.nT * .3) notes.push('The tempo was stately, in the manner of a person carrying a wardrobe.');
  if (s.loud > s.nD * .35) notes.push('It was also very loud, and a window has been reported.');
  else if (s.soft > s.nD * .35) notes.push('It was also very quiet. Those in the gallery report having enjoyed the coughing.');
  if (r.shape > .85 && r.bouquets >= 2) notes.push('The beat was drawn so clearly it could have been read from the upper circle.');
  if (r.time > .85) notes.push('The time was kept with a steadiness the Town Hall clock might study.');
  if (r.cue > .9 && r.fix > .7 && r.bouquets >= 1) notes.push('Every player was looked after, and every player knew it.');
  body.push(notes.slice(0, 4).join(' ') || 'There is little more to report, which is, in this town, a compliment.');
  const close = [['The Committee meets on Thursday.', 'Refunds may be sought from the Treasurer, who has left.'],
    ['With practice, who can say.', 'The Society is at home to subscribers on Tuesdays.'],
    ['We look forward to the next item with something like hope.', 'Your correspondent stayed to the end, and not from duty.'],
    ['Flowers were thrown. A hat was thrown. The hat has not been claimed.', 'Your correspondent does not recall leaving.']];
  body.push(pick(close[r.bouquets], seed >> 2));
  return { head, body };
}
function list(a) { return a.length < 2 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
const cap = (s) => s[0].toUpperCase() + s.slice(1);
