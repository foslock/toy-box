// The kingdom as a map: a triangle of isometric tiles, the same for every generation of a house. The crossroads is the
// bottom corner; every choice steps up-left or up-right, so the map only ever widens, and every tile has two ways on.
// The middle is the country, open to the wilds; above it lie the Crownlands, where the crown is fought for; and along
// the top edge runs the royal city, where the procession ends. Nothing here marks where the throne room is: it is
// whichever tile of the top edge a crowned heir's last choice leads to. When the fog lifts, the kingdom shows itself
// as every tile between the crossroads and that throne room (see kingdomOf).
//
// A tile is found by (row, col): row counts up from the crossroads (0) to the top edge (D), col is how far left (−)
// or right (+) of the middle it is. Stepping up-left is (row + 1, col − 1); up-right is (row + 1, col + 1). On the grid
// that's (gx, gy) with gx = D − (row − col) / 2 and gy = D − (row + col) / 2.
import { ROWS, JOURNEY, CROWN_ROW } from './rules.js';
import { rng, hash2 } from './util.js';

export const D = ROWS;
export const N = D + 1;                       // tiles along each side of the grid the triangle sits in
export const gridOf = (row, col) => ({ gx: D - (row - col) / 2, gy: D - (row + col) / 2 });
export const rowColOf = (gx, gy) => ({ row: 2 * D - gx - gy, col: gx - gy });
export const inside = (row, col) => row >= 0 && row <= D && Math.abs(col) <= row && ((row + col) & 1) === 0;
export const keyOf = (row, col) => { const { gx, gy } = gridOf(row, col); return gy * N + gx; };

// The kingdom a crowned heir rules, as it shows when the fog lifts: every tile a road from the crossroads could cross
// on its way to their throne room. On the grid that's a rectangle with the crossroads and the throne at opposite
// corners, so on screen a diamond with the throne room at its top.
export function kingdomOf(throne) {
  const t = gridOf(throne.row, throne.col);
  return { gx: t.gx, gy: t.gy, has: (gx, gy) => gx >= t.gx && gy >= t.gy, hasCell: (row, col) => { const g = gridOf(row, col); return inside(row, col) && g.gx >= t.gx && g.gy >= t.gy; } };
}

// Where each region sits: seeds placed through the middle of the country, each claiming the tiles nearest to it (laid
// out for a 12-step road, and stretched to the road's length).
const K = JOURNEY / 12;
const SEEDS = [[3, -2, 'low'], [3, 2, 'low'], [6, -5, 'mid'], [6, 0, 'mid'], [6, 5, 'mid'], [9, -7, 'high'], [9, -2, 'high'], [9, 3, 'high'], [9, 8, 'high'], [11, -10, 'high'], [11, 10, 'high']]
  .map(([row, col, band]) => [row * K, col * K, band]);
const POOLS = { low: ['farm', 'wood', 'lake', 'fen', 'farm'], mid: ['wood', 'fen', 'hills', 'moor', 'lake', 'farm'], high: ['hills', 'moor', 'waste', 'snow', 'wood', 'fen', 'snow', 'waste'] };

export function makeWorld(seed) {
  const r = rng(seed ^ 0x5a17);
  const used = {};
  const seeds = SEEDS.map(([row, col, band]) => {
    const pool = POOLS[band].filter(b => (used[b] || 0) < 2);
    const biome = r.pick(pool.length ? pool : POOLS[band]);
    used[biome] = (used[biome] || 0) + 1;
    return { row: row + (r() - .5) * 1.6, col: col + (r() - .5) * 2.6, biome };
  });
  const cells = new Array(N * N).fill(null);
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    const { row, col } = rowColOf(gx, gy);
    if (row > D) continue;                       // above the top edge: no kingdom there
    const v = hash2(gx, gy, seed), v2 = hash2(gx + 71, gy - 13, seed);
    const c = { gx, gy, row, col, v, v2, biome: 'farm', h: 0, feat: '' };
    if (row > CROWN_ROW) city(c, row - CROWN_ROW, col);
    else {
      if (row <= 1) c.biome = 'farm';
      else if (row > JOURNEY) c.biome = 'crown';
      else {
        let best = Infinity;
        for (const s of seeds) {
          const d = Math.hypot((row - s.row) * 1.15, (col - s.col) * .8) + (hash2(gx * 3, gy * 5, seed) - .5) * 1.6;
          if (d < best) { best = d; c.biome = s.biome; }
        }
      }
      decorate(c, row === 0);
    }
    cells[gy * N + gx] = c;
  }
  return { seed, cells, at: (row, col) => inside(row, col) ? cells[keyOf(row, col)] : null };
}

// What grows or stands on a tile of the country when nothing's happening there.
function decorate(c, crossroads) {
  const v = c.v, b = c.biome;
  if (crossroads) { c.feat = 'crossroads'; return; }
  if (b === 'farm') c.feat = v < .45 ? 'field' : v < .6 ? 'tree' : v < .68 ? 'cottage' : v < .78 ? 'hedge' : '';
  else if (b === 'wood') c.feat = v < .72 ? 'trees' : v < .82 ? 'tree' : '';
  else if (b === 'fen') c.feat = v < .45 ? 'pool' : v < .7 ? 'reeds' : v < .8 ? 'deadtree' : '';
  else if (b === 'hills') { c.h = v < .3 ? 2 : v < .75 ? 1 : 0; c.feat = v < .14 ? 'peak' : v < .45 ? 'rocks' : v < .6 ? 'tree' : ''; }
  else if (b === 'moor') c.feat = v < .35 ? 'heather' : v < .48 ? 'stone' : v < .62 ? 'rocks' : '';
  else if (b === 'lake') c.feat = v < .55 ? 'water' : v < .7 ? 'reeds' : v < .8 ? 'tree' : '';
  else if (b === 'waste') c.feat = v < .3 ? 'ash' : v < .5 ? 'stump' : v < .62 ? 'bones' : v < .72 ? 'crack' : '';
  else if (b === 'snow') { c.h = v < .35 ? 1 : 0; c.feat = v < .15 ? 'peak' : v < .5 ? 'pines' : v < .65 ? 'rocks' : ''; }
  else if (b === 'crown') c.feat = v < .3 ? 'flowers' : v < .5 ? 'hedge' : v < .62 ? 'tree' : v < .7 ? 'statue' : v < .8 ? 'field' : '';
}

// The royal city along the top edge: its wall first (the procession comes through it wherever the road meets it),
// then streets of houses round towers, squares and fountains, and last the palace halls, towers and gardens that make
// up the top edge itself.
function city(c, u, col) {
  c.biome = 'city';
  const v = c.v;
  if (u === 1) { c.feat = ((col % 6) + 6) % 6 === 3 ? 'walltower' : 'wall'; return; }
  if (u === D - CROWN_ROW) { c.feat = v < .45 ? 'hall' : v < .75 ? 'keep' : 'garden'; return; }
  c.feat = v < .07 ? 'cathedral' : v < .16 ? 'plaza' : v < .22 ? 'fountain' : v < .34 ? 'tower' : 'house';
}
