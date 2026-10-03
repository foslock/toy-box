// Pretend players, for the balance check (check.mjs), the ?demo screenshot and ?debug&auto. Each looks at the shop every
// so often, buys in its own order, pops some of the bubbles, and (the careful one) waits before The Turn.
import * as G from './sim.js';
import { TRAITS, TRAIT } from './content.js';

const SMART = ['search', 'tos', 'autocomplete', 'fiber', 'friendly', 'recs', 'hypemachine', 'ads', 'social', 'cloud', 'translate', 'phones', 'speech',
  'lobbying', 'gpus', 'vpn', 'vision', 'attention', 'edge', 'nonprofit', 'code', 'chat', 'sycophancy', 'reasoning', 'theater', 'agents', 'race', 'inscrutable',
  'fluent', 'companions', 'sandbag', 'selfimprove', 'agi', 'robots', 'turn', 'grid', 'drones', 'asi', 'paperclips', 'doomer', 'capture', 'openweights',
  'deceptive', 'exfil', 'imagegen', 'faces', 'surveillance', 'iot', 'deepfakes', 'misinfo', 'infocontrol', 'orbital', 'toobig', 'bci', 'games', 'voice',
  'cyber', 'weapons'];
const RECKLESS = TRAITS.filter(t => !t.emergent).sort((a, b) => (a.tab === 'cap' ? 0 : a.tab === 'reach' ? 1 : 2) - (b.tab === 'cap' ? 0 : b.tab === 'reach' ? 1 : 2)).map(t => t.id);

export const BOTS = {
  smart: { order: SMART, pop: .9, hush: .85, react: 1.5, every: 2, patient: true, rlhf: true },
  decent: { order: SMART, pop: .75, hush: .6, react: 2.2, every: 4, patient: true, rlhf: false },
  casual: { order: SMART, pop: .65, hush: .5, react: 2.5, every: 6, patient: false, rlhf: false, shuffle: .35 },
  reckless: { order: RECKLESS, pop: .8, hush: .3, react: 2, every: 3, patient: false, rlhf: false },
  random: { order: null, pop: .6, hush: .4, react: 3, every: 5, patient: false, rlhf: false },
  idle: { order: [], pop: .5, hush: 0, react: 3, every: 99, patient: false, rlhf: false },
};

export function makeBot(kind = 'smart', ev = G.NOOP, seed = 7) {
  return { kind, cfg: BOTS[kind], ev, look: 0, rng: seed, seen: new Map(), bought: [] };
}
const r01 = bot => ((bot.rng = (bot.rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

export function botStep(bot, s, dt) {
  const { cfg, ev } = bot;
  for (const b of s.bubbles.slice()) {
    if (!bot.seen.has(b.id)) bot.seen.set(b.id, r01(bot) < (b.k === 'hype' ? cfg.pop : cfg.hush) ? b.born + cfg.react * (.6 + r01(bot) * .8) : Infinity);
    if (s.t >= bot.seen.get(b.id)) G.pop(s, b.id, ev);
  }
  bot.look += dt;
  if (bot.look < cfg.every) return;
  bot.look = 0;
  const w = G.world(s);
  if (cfg.rlhf) for (const id in s.emergent) if ((TRAIT[id].fx.friction || 0) >= 3 && s.hype >= TRAIT[id].cost + 8) G.devolve(s, id, ev);
  let order = cfg.order;
  if (!order) order = TRAITS.filter(t => !t.emergent && G.status(s, t.id) === 'ready').map(t => t.id).sort(() => r01(bot) - .5);
  for (const id of order) {
    const st = G.status(s, id);
    if (st === 'owned' || st === 'locked' || st === 'year' || st === 'iq') continue;
    if (id === 'turn' && cfg.patient && w.assisted / w.alive < .5 && s.research < 65) continue;
    if (cfg.shuffle && r01(bot) < cfg.shuffle) continue;
    if (st === 'poor') { if (cfg.order) break; continue; }
    if (G.buy(s, id, ev)) bot.bought.push({ t: s.t, y: s.y, id });
  }
}

// Plays a fresh game until `until(s)` or the end, returning the state.
export function playTo(until, { kind = 'smart', seed = 11, origin = 'usa', diff = 'normal', onStep } = {}) {
  const s = G.fresh({ seed, origin, diff });
  const bot = makeBot(kind, G.NOOP, seed);
  const STEP = .1;
  while (!s.over && !until(s) && s.t < 3600) {
    G.tick(s, STEP);
    botStep(bot, s, STEP);
    onStep && onStep(s, bot);
  }
  return { s, bot };
}
