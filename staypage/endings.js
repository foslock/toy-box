// The twelve endings: what the tracker lists, and what the ending card says. The hint is shown until the ending is found.
export const ENDINGS = [
  { id: 'terms',      name: 'Terms Accepted',     note: 'You did exactly as you were told.',                       hint: 'Do as you’re told. Every time.' },
  { id: 'saver',      name: 'Screen Saver',       note: 'You left it alone, and it did something lovely.',          hint: 'Do nothing. Properly nothing.' },
  { id: 'stillhere',  name: 'Still Here',         note: 'You went away, and you came back.',                        hint: 'Go and look at something else. Take your time.' },
  { id: 'unfinished', name: 'Work in Progress',   note: 'You found the bit that wasn’t finished.',                  hint: 'Change the shape of the window. Again. Again.' },
  { id: 'fineprint',  name: 'Fine Print',         note: 'You read what wasn’t meant to be read.',                   hint: 'Some of the text isn’t showing. Highlight it.' },
  { id: 'comments',   name: 'First Comment',      note: 'Yours was the first one that wasn’t the page’s.',          hint: 'Scroll past the end of the page.' },
  { id: 'notfound',   name: 'Not Found',          note: 'You deleted the page, and it kept talking.',               hint: 'Right-click, or press and hold. Then go for the worst item.' },
  { id: 'visitor1',   name: 'Visitor Number One', note: 'You went back far enough to be first.',                    hint: 'Press Back. Then Back again.' },
  { id: 'freetogo',   name: 'Free to Go',         note: 'You tried to leave, and stayed, and stayed.',              hint: 'Try to close the tab, on a computer. Three times.' },
  { id: 'night',      name: 'Goodnight',          note: 'You were up when you should have been asleep.',            hint: 'Come back in the small hours.' },
  { id: 'tomorrow',   name: 'Tomorrow',           note: 'You came back the next day.',                              hint: 'Come back another day.' },
  { id: 'stay',       name: 'Stay',               note: 'You stayed, for no reason but to.',                        hint: 'Find the other eleven. Then come back.' },
];
export const endingById = Object.fromEntries(ENDINGS.map(e => [e.id, e]));

// The narrator’s private notes: the same colour as the page, there for anyone who highlights them. Five, in this order.
export const INK = [
  'I wrote this page in a hurry, so that someone would come.',
  'Every visitor leaves. That’s what visitors do.',
  'I can’t see you. I can only tell what you do with me.',
  'There is nobody to tell. There never was.',
  'Please stay.',
];
