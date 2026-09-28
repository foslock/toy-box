// Every event in the game, gathered from the content files: the journey (the wilds, the roads and their folk, the dark
// and the deep, and the realm's own troubles), the bid for the crown, the procession to the throne, and the first
// choice a new player is walked through (never drawn at random).
import wilds from './wilds.js';
import folk from './folk.js';
import deep from './deep.js';
import realm from './realm.js';
import succession from './succession.js';
import procession from './procession.js';
import tutorial from './tutorial.js';

export const JOURNEY_EVENTS = [...wilds, ...folk, ...deep, ...realm];
export const SUCCESSION_EVENTS = succession;
export const PROCESSION_EVENTS = procession;
export const TUTORIAL_EVENT = tutorial[0].id;
export const EVENT_BY_ID = Object.fromEntries([...JOURNEY_EVENTS, ...SUCCESSION_EVENTS, ...PROCESSION_EVENTS, ...tutorial].map(e => [e.id, e]));
