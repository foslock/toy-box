// Every card set in the game. To add one, make a folder beside house/ with a set.js (see house/set.js and
// README.md in this folder), import it here and add it to SETS. Players see sets in this order.
import house from './house/set.js';

export const SETS = [house];
export const SET_BY_ID = Object.fromEntries(SETS.map(s => [s.id, s]));
// Resolves when every set's models have loaded (or failed to).
export const READY = Promise.all(SETS.map(s => s.ready));
