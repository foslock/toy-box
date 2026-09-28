// Every event in the game, gathered from the content files: the journey (the wilds, the roads and their folk, the dark
// and the deep, the realm's own troubles, beasts and monsters, the uncanny, and the feuds, curses, boons and unfinished
// business one life leaves the next), the bid for the crown, the procession to the throne, and the first choice a new
// player is walked through (never drawn at random).
import wilds from './wilds.js';
import folk from './folk.js';
import deep from './deep.js';
import realm from './realm.js';
import beasts from './beasts.js';
import uncanny from './uncanny.js';
import feuds from './feuds.js';
import heritage from './heritage.js';
import succession from './succession.js';
import crown from './crown.js';
import procession from './procession.js';
import pageant from './pageant.js';
import tutorial from './tutorial.js';

export const JOURNEY_EVENTS = [...wilds, ...folk, ...deep, ...realm, ...beasts, ...uncanny, ...feuds, ...heritage];
export const SUCCESSION_EVENTS = [...succession, ...crown];
export const PROCESSION_EVENTS = [...procession, ...pageant];
export const TUTORIAL_EVENT = tutorial[0].id;
export const EVENT_BY_ID = Object.fromEntries([...JOURNEY_EVENTS, ...SUCCESSION_EVENTS, ...PROCESSION_EVENTS, ...tutorial].map(e => [e.id, e]));
