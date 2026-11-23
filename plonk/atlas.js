// The world plus everything written on it: scripts, town names.
import { buildWorld, COUNTRIES, rng } from './world.js';
import { makeScript, makeWord } from './script.js';

export const WORLD_SEED = 11;

export function makeAtlas() {
  const world = buildWorld(WORLD_SEED);
  const scripts = COUNTRIES.map((c, i) => makeScript(c.script, 4100 + i * 31));
  const r = rng(909);
  for (const t of world.towns) t.word = makeWord(r, t.capital ? 4 + ((r() * 2) | 0) : 3 + ((r() * 3) | 0));
  return { world, scripts };
}
