// Which scene plays for which character. To add or rework one, write it in the file for its group (letters.js shows the shape of a
// scene; anim.js and kit.js are what it draws with), then look at it with ?film=Qq (a filmstrip of that character as typed, so
// a capital shows the louder version; film.js lists the options). ?text=Hi|There types a phrase for you, ?fps shows the frame rate.
import { LETTERS } from './letters.js';
import { SCENES as LETTERS_B } from './letters-b.js';
import { SCENES as LETTERS_C } from './letters-c.js';
import { SCENES as LETTERS_D } from './letters-d.js';
import { SCENES as NUMBERS } from './numbers.js';
import { SCENES as MARKS_A } from './marks-a.js';
import { SCENES as MARKS_B } from './marks-b.js';
import { SCENES as MARKS_C } from './marks-c.js';
import { FALLBACK, LIGHT } from './extras.js';

const TABLE = { ...LETTERS, ...LETTERS_B, ...LETTERS_C, ...LETTERS_D, ...NUMBERS, ...MARKS_A, ...MARKS_B, ...MARKS_C };
export const sceneFor = ch => TABLE[ch] || TABLE[ch.toUpperCase()] || FALLBACK;
export { LIGHT, TABLE };
