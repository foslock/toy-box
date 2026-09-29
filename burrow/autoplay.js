// A stand-in player, for the headless balance runs (balance.mjs) and the page's ?demo. It steers the worm the way a
// person might: toward the most worthwhile find it can reach, home to the camp when its belly is full (or it's
// hurt), and at the camp it buys upgrades. When the way is blocked by rock it can't shake, it plans a path around
// on a coarse grid. Styles: 'good' plays well; 'casual' is slower to choose, wanders a little and goes home early,
// more like someone playing for the first time; 'greedy' buys whatever it can afford the moment it can.
import { W, H, GROUND, STRATA, ITEMS, SLOTS_BY_SIZE, UPGRADES, CAMP, CORE_X, CORE_Y, CORE_R, ALLOY, LAVA, AIR, GAS } from './rules.js';
import { SOLID, TIER, LIQ, OREV } from './sim.js';

const G = 4;                                          // path grid: 4×4 cells to a square
const GW = W / G;

export function makePlayer(style = 'good', rand = Math.random) {
  const casual = style === 'casual';
  let mode = 'dive', target = null, path = null, pathAt = 0, choose = 0, stuckT = 0, lastX = 0, lastY = 0, checkAt = 0, bad = new Map(), wobble = 0, wobbleT = 0;
  let bestD = Infinity, bestAt = 0, goalKey = '';
  const play = function (game) {
    const w = game.worm, t = game.t;
    // at the camp: sell (automatic), spend, then go back down
    if (game.atCamp) {
      shop(game, style);
      if (mode === 'home') { mode = 'dive'; target = null; path = null; }
    }
    const room = game.cap() - game.belly;
    const lowHp = game.hp < game.hpMax() * .35;
    const last = game.up.vib >= STRATA.length - 1;
    const goHome = (!last && (room < (casual ? 1.6 : .95) || (casual && room < game.cap() * .12))) || lowHp;
    if (goHome && mode !== 'home' && !game.atCamp) { mode = 'home'; target = null; path = null; }
    if (game.won) { game.steer = null; return; }

    // stuck? (not getting anywhere for a while) — plan a way round, and give up on that target for a bit
    if (t > checkAt) {
      const moved = Math.hypot(w.x - lastX, w.y - lastY);
      stuckT = moved < 6 ? stuckT + (t - checkAt + 1.2) : 0;
      lastX = w.x; lastY = w.y; checkAt = t + 1.2;
      if (stuckT > 2.2) {
        stuckT = 0;
        if (target?.obj) bad.set(target.obj.id, t + 40);
        if (target?.cell !== undefined) bad.set('c' + target.cell, t + 40);
        path = planPath(game, mode === 'home' ? homeGoal(game) : target || deeper(game));
        pathAt = t;
        if (!path) {
          // no way found from here: back out the way it came (up), then look again
          if (mode !== 'home') target = null;
          path = [{ x: w.x + (rand() - .5) * 20, y: w.y - 14 }];
        }
      }
    }

    // not getting any nearer to where it's going (bouncing about in a pit, say) counts as stuck too
    const gk = mode === 'home' ? 'home' : target ? (target.obj ? 'o' + target.obj.id : 'c' + target.cell) : 'deep';
    const gp = mode === 'home' ? homeGoal(game) : target || deeper(game), gd = Math.hypot(gp.x - w.x, gp.y - w.y);
    if (gk !== goalKey) { goalKey = gk; bestD = gd; bestAt = t; }
    else if (gd < bestD - 8) { bestD = gd; bestAt = t; }
    else if (t - bestAt > 3.5 && (!path || t - pathAt > 3.5)) {
      bestAt = t; bestD = gd;
      if (target?.obj) bad.set(target.obj.id, t + 40);
      if (target?.cell !== undefined) bad.set('c' + target.cell, t + 40);
      path = planPath(game, gp);
      pathAt = t;
      if (!path) { if (mode !== 'home') target = null; path = [{ x: w.x + (rand() - .5) * 40, y: w.y - 14 }]; }
    }
    if (game.up.vib >= STRATA.length - 1 && mode !== 'home') target = null;     // all it can shake: straight for the core
    let goal;
    if (mode === 'home') goal = homeGoal(game);
    else {
      if (game.up.vib < STRATA.length - 1 && (!target || t > choose || (target.obj && target.obj.gone) || (target.cell !== undefined && !OREV[game.mat[target.cell]]))) {
        target = pick(game, bad, t, casual, rand);
        choose = t + (casual ? 1.6 : .6);
      }
      goal = target || deeper(game);
    }
    // follow a planned path while it lasts
    if (path && path.length && t - pathAt < 12) {
      while (path.length > 1 && Math.hypot(path[0].x - w.x, path[0].y - w.y) < 7) path.shift();
      goal = path[0];
      if (path.length === 1 && Math.hypot(path[0].x - w.x, path[0].y - w.y) < 7) path = null;
    } else path = null;
    // a person's aim wanders a little
    if (casual) { if (t > wobbleT) { wobble = (rand() - .5) * 26; wobbleT = t + .8 + rand(); } goal = { x: goal.x + wobble, y: goal.y + wobble * .6 }; }
    // aim past the goal so the worm keeps its speed up
    const dx = goal.x - w.x, dy = goal.y - w.y, d = Math.hypot(dx, dy) || 1;
    const lead = d < 30 ? 30 / d : 1;
    game.steer = { x: w.x + dx * lead, y: w.y + dy * lead };
  };
  play.state = () => ({ mode, target: target && { x: target.x, y: target.y, kind: target.obj?.kind, cell: target.cell }, path: path?.length, stuckT });
  return play;
}

function homeGoal(game) {
  const w = game.worm, x = Math.max(CAMP.x0 + 10, Math.min(CAMP.x1 - 10, w.x));
  return { x, y: game.plan.surf[Math.round(x)] + 8 };      // just under the grass: the camp counts from 30 m down
}
// Nowhere better to go: down, toward the deepest rock it can shake (or the core, when it can shake everything).
function deeper(game) {
  const w = game.worm, vib = game.up.vib;
  if (vib >= STRATA.length - 1) return { x: CORE_X, y: CORE_Y - CORE_R + 4 };
  const floor = GROUND + STRATA[vib + 1].top - 20;
  return { x: w.x + (w.x < W / 2 ? 30 : -30), y: Math.min(floor, w.y + 120) };
}

// The most worthwhile thing in reach: finds it can swallow, and veins of ore, weighed by worth over distance.
function pick(game, bad, t, casual, rand) {
  const w = game.worm, vib = game.up.vib, room = game.cap() - game.belly;
  let best = null, bestS = 0;
  const y0 = w.y - 260, y1 = w.y + 360, deepest = GROUND + (vib < STRATA.length - 1 ? STRATA[vib + 1].top : H);
  for (let b = Math.max(0, Math.floor(y0 / 64)); b <= Math.min(game.objBand.length - 1, Math.floor(y1 / 64)); b++) {
    for (const o of game.objBand[b]) {
      if (o.gone || o.fresh || o.hazard) continue;
      const I = ITEMS[o.kind];
      if (o.kind !== 'cache' && (I.size > game.up.maw + 1 || SLOTS_BY_SIZE[I.size] > room + 1e-6)) continue;
      const c = game.cell(o.x, o.y);
      if (SOLID[c] && TIER[c] > vib) continue;
      if (o.y > deepest + 10) continue;
      const until = bad.get(o.id);
      if (until && until > t) continue;
      const v = o.kind === 'cache' ? o.cache.value : I.value;
      const d = Math.hypot(o.x - w.x, (o.y - w.y) * (o.y < w.y ? 1.4 : 1));
      const s = v / (d + 35) * (casual ? .7 + rand() * .6 : 1);
      if (s > bestS) { bestS = s; best = { x: o.x, y: o.y, obj: o }; }
    }
  }
  // ore: look at a sprinkling of cells nearby
  const R = 110;
  for (let k = 0; k < 90; k++) {
    const x = Math.floor(w.x + (rand() - .5) * 2 * R), y = Math.floor(w.y + (rand() - .3) * 2 * R);
    if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1 || !game.built[y >> 6]) continue;
    const i = y * W + x, m = game.mat[i];
    if (!OREV[m] || TIER[m] > vib || room < .2) continue;
    const until = bad.get('c' + i);
    if (until && until > t) continue;
    const s = OREV[m] * 14 / (Math.hypot(x - w.x, y - w.y) + 35);
    if (s > bestS) { bestS = s; best = { x: x + .5, y: y + .5, cell: i }; }
  }
  return best;
}

// Spend at the camp: Vibration first when it can, keeping the belly and the rest roughly in step with it.
function shop(game, style) {
  for (let guard = 0; guard < 20; guard++) {
    const v = game.up.vib, want = { belly: Math.min(7, v + 1), muscle: Math.min(6, v), maw: [0, 1, 1, 2, 2, 3, 3, 4][v], hide: [0, 1, 1, 2, 3, 4, 5, 6][v] };
    const options = [];
    for (const u of UPGRADES) {
      const c = game.cost(u.id);
      if (c === null || c > game.money) continue;
      if (style === 'greedy') { options.push([u.id, c]); continue; }
      if (u.id === 'vib') options.push([u.id, c * .5]);
      else if (game.up[u.id] < want[u.id]) options.push([u.id, c]);
      else if (game.up[u.id] < want[u.id] + 1 && c < game.money * .25) options.push([u.id, c * 3]);
    }
    if (!options.length) return;
    options.sort((a, b) => a[1] - b[1]);
    if (!game.buy(options[0][0]).ok) return;
  }
}

/* ---------- a way round ---------- */
// Dijkstra on 4×4 squares between the worm and a goal: squares with rock it can't shake are walls; open air costs
// more (it can only fall through it), and lava a lot more.
function planPath(game, goal) {
  if (!goal) return null;
  const w = game.worm, vib = game.up.vib;
  const top = Math.max(0, Math.min(w.y, goal.y) - 120), bot = Math.min(H - 1, Math.max(w.y, goal.y) + 120);
  const r0 = Math.floor(top / G), rows = Math.floor(bot / G) - r0 + 1, n = rows * GW;
  const cost = new Uint8Array(n);
  // a square is a wall if rock it can't shake comes within its head's reach of the square's middle
  const e = Math.max(0, Math.ceil(game.collR() - G / 2 + .5));
  for (let r = 0; r < rows; r++) for (let c = 0; c < GW; c++) {
    let block = 0, open = 0, lava = 0;
    for (let yy = -e; yy < G + e; yy++) for (let xx = -e; xx < G + e; xx++) {
      const y = (r0 + r) * G + yy, x = c * G + xx;
      if (x < 0 || x >= W) continue;
      if (y < 0) continue;
      if (y >= H || !game.built[y >> 6]) { block++; continue; }
      const m = game.mat[y * W + x];
      if (SOLID[m] && TIER[m] > vib) block++;
      else if (yy >= 0 && yy < G && xx >= 0 && xx < G) { if (m === AIR || m === GAS) open++; else if (m === LAVA) lava++; }
    }
    cost[r * GW + c] = block > 0 ? 0 : lava > 4 ? 40 : open > 8 ? 3 : 1;
  }
  const idx = (x, y) => (Math.floor(y / G) - r0) * GW + Math.max(0, Math.min(GW - 1, Math.floor(x / G)));
  const s = idx(w.x, w.y), g = idx(goal.x, goal.y);
  if (s < 0 || s >= n || g < 0 || g >= n) return null;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const open = i => cost[i] === 3;
  const heap = [[0, s]];
  dist[s] = 0;
  const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]) continue;
    if (i === g) break;
    const r = (i / GW) | 0, c = i % GW;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= rows || cc < 0 || cc >= GW) continue;
      const j = rr * GW + cc, k = cost[j];
      if (!k) continue;
      if (dr && dc && (!cost[r * GW + cc] || !cost[rr * GW + c])) continue;   // no cutting corners between walls
      if (dr < 0 && open(i) && open(j)) continue;          // it can't climb through open air
      const nd = d + k * (dr && dc ? 1.41 : 1);
      if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); }
    }
  }
  if (!isFinite(dist[g])) return null;
  const out = [];
  for (let i = g; i >= 0 && i !== s; i = prev[i]) out.push({ x: (i % GW) * G + G / 2, y: (r0 + ((i / GW) | 0)) * G + G / 2 });
  out.reverse();
  return out;
}
