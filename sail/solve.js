// The navigator: searches every way the crew's orders could be spent from some point in a level to its harbour. The
// page asks it whether a voyage can still be finished after each buoy, and for a hint; check.mjs asks it everything
// else (is every level winnable, in how many ways, does it need each of its orders).
import { step, ORDER_IDS } from './rules.js';

export function navigator(lv) {
  const ids = ORDER_IDS.filter(o => lv.crew[o] > 0);
  const memo = new Map();
  const key = (s, leg, k, pool) => {
    let str = s.x + ',' + s.y + ',' + s.dir + ',' + s.sail + ',' + s.anc + ',' + s.broken + ',' + leg + ',' + k;
    for (const b of s.beasts) str += ',' + b.i + ',' + b.d;
    for (const o of ids) str += ',' + (pool[o] || 0);
    return str;
  };
  // How many ways there are to finish the voyage from here: leg is the mark being sailed for, k how many orders of
  // its scroll are already spent. Orders not needed once a mark is reached go back to the crew.
  function ways(s, leg, k, pool) {
    const kk = key(s, leg, k, pool), m = memo.get(kk);
    if (m !== undefined) return m;
    let n = 0;
    for (const o of ids) {
      if (!(pool[o] > 0)) continue;
      const r = step(lv, s, o, lv.marks[leg]);
      if (r.wreck) continue;
      pool[o]--;
      if (r.touched) n += leg === lv.legs.length - 1 ? 1 : ways(r.s, leg + 1, 0, pool);
      else if (k + 1 < lv.legs[leg]) n += ways(r.s, leg, k + 1, pool);
      pool[o]++;
    }
    memo.set(kk, n);
    return n;
  }
  // One way to finish the leg from here, given the orders already on its scroll (null if there's none that still
  // lets the rest of the voyage be finished): the orders to add, in order.
  function finishLeg(s, leg, pool, placed = []) {
    pool = { ...pool };
    let k = 0;
    for (const o of placed) {
      if (!(pool[o] > 0)) return null;
      const r = step(lv, s, o, lv.marks[leg]);
      if (r.wreck) return null;
      pool[o]--; s = r.s; k++;
      if (r.touched) return leg === lv.legs.length - 1 || ways(s, leg + 1, 0, pool) > 0 ? [] : null;
    }
    const out = [];
    for (; k < lv.legs[leg]; k++) {
      let found = null;
      for (const o of ids) {
        if (!(pool[o] > 0)) continue;
        const r = step(lv, s, o, lv.marks[leg]);
        if (r.wreck) continue;
        pool[o]--;
        const ok = r.touched ? (leg === lv.legs.length - 1 || ways(r.s, leg + 1, 0, pool) > 0) : k + 1 < lv.legs[leg] && ways(r.s, leg, k + 1, pool) > 0;
        pool[o]++;
        if (ok) { found = { o, r }; break; }
      }
      if (!found) return null;
      out.push(found.o); pool[found.o]--; s = found.r.s;
      if (found.r.touched) break;
    }
    return out;
  }
  return {
    ways: (s, leg, pool, k = 0) => ways(s, leg, k, { ...pool }),
    canFinish: (s, leg, pool) => ways(s, leg, 0, { ...pool }) > 0,
    finishLeg,
  };
}
