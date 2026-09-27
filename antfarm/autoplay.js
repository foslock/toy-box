// A stand-in player, for the headless balance runs (balance.mjs) and the page's ?demo: it puts in the first ant and
// then spends food the way a player might. Styles: 'idle' never buys anything after the first ant; 'greedy' buys a
// worker whenever it can afford one; 'balanced' keeps some food back, digs for food, buys aphids and upgrades, and
// gets a queen once the colony is going.
import { W, H, ANTS, UPGRADES, MAX_LEVEL, ITEMS, diggable } from './rules.js';
import { X, Y, INF } from './sim.js';

// A good first spot: in the dirt, a little way down, somewhere in the middle half.
export function firstSpot(farm, rand = Math.random) {
  const x = Math.round(W * (.3 + rand() * .4));
  return { x, y: farm.surf[x] + 10 + Math.round(rand() * 10) };
}

// A cell in the colony's tunnels to put a new ant in.
function inTunnels(farm, rand) {
  const home = farm.field('home');
  if (!home) return null;
  const cells = [];
  for (let i = 0; i < W * H; i += 5) if (home.dist[i] < INF && !farm.isSky(i)) cells.push(i);
  if (!cells.length) return null;
  const c = cells[Math.floor(rand() * cells.length)];
  return { x: X(c), y: Y(c) };
}

// Dirt a few cells off the tunnels, clear of other food: where aphids would be handy.
function aphidSpot(farm, rand) {
  const home = farm.field('home');
  if (!home) return null;
  for (let t = 0; t < 200; t++) {
    const x = 6 + Math.floor(rand() * (W - 12)), y = farm.surf[x] + 8 + Math.floor(rand() * (H - farm.surf[x] - 14));
    const i = y * W + x;
    if (!diggable(farm.mat[i]) || farm.roomOf[i]) continue;
    let near = INF;
    for (let dy = -7; dy <= 7; dy += 2) for (let dx = -7; dx <= 7; dx += 2) { const j = (y + dy) * W + x + dx; if (j >= 0 && j < W * H && home.dist[j] < near) near = home.dist[j]; }
    if (near >= INF) continue;
    if (farm.sources.some(s => !s.gone && Math.hypot(s.x - x, s.y - y) < 12)) continue;
    return { x, y };
  }
  return null;
}

export function makePlayer(style = 'balanced', rand = Math.random) {
  let next = 0;
  return function play(farm) {
    if (farm.t < next) return;
    next = farm.t + 1;
    if (!farm.colony) { const s = firstSpot(farm, rand); farm.placeAnt('worker', s.x, s.y); return; }
    if (style === 'idle') return;
    const pop = farm.ants.length, has = t => farm.count(t);
    const buy = t => { const s = inTunnels(farm, rand); return s && farm.placeAnt(t, s.x, s.y).ok; };
    if (style === 'greedy') { while (farm.food >= ANTS.worker.cost && buy('worker')); return; }
    // balanced
    if (farm.canPlaceItem('feed').ok && rand() < .3) {
      const e = farm.entrances.length ? farm.entrances[0] : W / 2;
      farm.placeItem('feed', e + (rand() < .5 ? -8 : 8), 0);
    }
    // The first thing on this list that applies is what it saves up for; it buys nothing else meanwhile.
    const reserve = 4 + pop * .8, spare = farm.food - reserve;
    const sup = farm.supply();
    const unreached = farm.sources.some(s => s.known && !s.reach && !s.gone);
    const unknown = farm.sources.some(s => !s.known && !s.gone);
    const bought = farm.sources.filter(s => s.bought).length;
    const nextUpgrade = ['thrift', 'loads', 'ranch', 'jaws', 'legs', 'nose'].find(id => farm.lvl(id) < MAX_LEVEL && (id !== 'ranch' || bought >= 1));
    const goals = [];
    if (pop < 3) goals.push(['worker']);
    if (!has('scout') && unknown && pop >= 3) goals.push(['scout']);
    if (has('digger') < 1 + Math.floor(pop / 8) && (unreached || farm.projects.some(p => !p.done))) goals.push(['digger']);
    if (!has('queen') && pop >= 10) goals.push(['queen']);
    if (pop < sup.ants * .8 && !has('queen')) goals.push(['worker']);   // most of what the never-ending food can feed (a queen does this herself)
    if (pop >= 8 && bought < 1 + Math.floor(pop / 10)) goals.push(['aphids']);
    if (has('queen') && has('nurse') < 2) goals.push(['nurse']);
    if (pop >= 20 && has('officer') < 1 + Math.floor(pop / 40)) goals.push(['officer']);
    if (nextUpgrade && pop >= 6) goals.push(['upgrade', nextUpgrade]);
    if (pop < sup.ants * .9 && !has('queen')) goals.push(['worker']);
    const [g, arg] = goals[0] || [];
    if (!g) return;
    if (g === 'aphids') { if (spare >= farm.itemCost('aphids')) { const s = aphidSpot(farm, rand); if (s) farm.placeItem('aphids', s.x, s.y); } return; }
    if (g === 'upgrade') { const u = UPGRADES.find(q => q.id === arg); if (spare >= u.costs[farm.lvl(arg)]) farm.buyUpgrade(arg); return; }
    if (spare >= ANTS[g].cost || (pop < 3 && farm.food >= ANTS[g].cost + 3)) buy(g);
  };
}
