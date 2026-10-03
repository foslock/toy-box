// A pretend player, for the balance check (check.mjs), the ?demo screenshot and ?debug&auto. It taps at a set rate,
// reads each new card for a moment before buying it, buys more of things when it isn't saving up, hands out jars, and
// minds the warmth.
import * as G from './sim.js';

export const BOTS = {
  eager: { taps: [5, 2, 1, 0.5], read: 1, every: 1, warm: 'pulse' },
  steady: { taps: [3, 1, 0.4, 0.2], read: 3, every: 2, warm: 'pulse' },
  idle: { taps: [1.2, 0.1, 0, 0], read: 5, every: 10, warm: 'safe' },
  lazy: { taps: [0.3, 0, 0, 0], read: 10, every: 30, warm: 'safe' },
};

export function makeBot(kind = 'steady', ev = G.NOOP) {
  return { kind, cfg: BOTS[kind], ev, tapDebt: 0, look: 0, bought: [] };
}

// Moves the bot's player on by dt seconds; the caller ticks the sim.
export function botStep(bot, s, dt) {
  const { cfg, ev } = bot;
  bot.tapDebt += cfg.taps[s.phase] * dt;
  while (bot.tapDebt >= 1) { G.tap(s, ev); bot.tapDebt--; }
  bot.look += dt;
  if (bot.look < cfg.every) return;
  bot.look = 0;

  const open = G.openProjects(s).filter(p => s.t - s.shown[p.id] >= cfg.read)
    .sort((a, b) => (a.cost.b || 0) + (a.cost.m || 0) * 1000 - (b.cost.b || 0) - (b.cost.m || 0) * 1000);
  for (const p of open) if (G.buy(s, p.id, ev)) bot.bought.push({ t: s.t, what: G.nameIt(s, p.name), phase: s.phase });

  // more of things, keeping enough back for the next project in that currency when it's close
  const want = { b: 0, m: 0 };
  for (const p of G.openProjects(s)) for (const c of ['b', 'm']) if (p.cost[c]) want[c] = want[c] ? Math.min(want[c], p.cost[c]) : p.cost[c];
  let more = true, guard = 0;
  while (more && guard++ < 200) {
    more = false;
    const ms = G.openMakers(s).filter(m => G.canMake(s, m.id)).sort((a, b) => G.costOf(s, a.id) - G.costOf(s, b.id));
    for (const m of ms) {
      const purse = m.cur === 'b' ? s.b : s.money;
      const c = G.costOf(s, m.id);
      const r = s._r || G.rates(s);
      const income = m.cur === 'b' ? r.bps : (r.mps || 0);
      const save = want[m.cur] && (want[m.cur] - purse) / Math.max(income, 1e-9) < 40 ? want[m.cur] : 0;
      if (purse - c >= save || purse >= 4 * c) {
        if (G.make(s, m.id, ev)) { more = true; bot.bought.push({ t: s.t, what: `${m.name} ×${s.n[m.id]}`, phase: s.phase, maker: true }); }
        break;
      }
    }
  }
  if (G.canGive(s) && s.jars < 40) G.give(s, ev);
  if (s.phase === 3) {
    const k = G.stats(s);
    if (!k.auto) {
      if (cfg.warm === 'safe') G.setWarmth(s, k.safe);
      else G.setWarmth(s, s.over < 0.55 ? Math.min(1, k.safe + 0.3) : k.safe - 0.1);
    }
  }
}

// Plays from a fresh start until `until(s)` is true (or the game ends), ticking at dt. For ?demo and the check.
export function playTo(until, { kind = 'steady', seed = 7, dt = 0.1, limit = 4 * 3600, onStep } = {}) {
  const s = G.fresh(seed);
  const bot = makeBot(kind);
  while (!s.done && s.t < limit && !until(s)) {
    G.tick(s, dt, bot.ev);
    botStep(bot, s, dt);
    if (onStep) onStep(s, bot);
  }
  return { s, bot };
}
