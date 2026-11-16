// Breadth-first search over turns: walking is free, each turn costs one.
// State: arrangement, which connected patch you're in, keys, locks, treasure.
import { newState, reach, ladder, layerOf, turn, lockReachable } from './game.js';

export function solveFrom(st0, player, cap = 1500000) {
  const st = { ...st0, at: st0.at.slice(), pos: st0.pos.slice(), ori: st0.ori.slice() };
  const R = st.rooms;
  const tId = R.find(r => r.treasure).id;
  const enc = (player) => {
    let s = '';
    for (let p = 0; p < 27; p++) { const id = st.at[p]; s += String.fromCharCode(48 + id * 4 + st.ori[id]); }
    return s + '|' + player + '|' + st.keys + '|' + st.keysTaken + '|' + st.unlocked + '|' + (st.treasure ? 1 : 0);
  };
  const snap = (player) => ({ at: st.at.slice(), pos: st.pos.slice(), ori: st.ori.slice(), keys: st.keys, keysTaken: st.keysTaken, unlocked: st.unlocked, treasure: st.treasure, player });
  const load = (s) => { st.at.set(s.at); st.pos.set(s.pos); st.ori.set(s.ori); st.keys = s.keys; st.keysTaken = s.keysTaken; st.unlocked = s.unlocked; st.treasure = s.treasure; };

  const seen = new Map();
  const roomsSeen = new Set(); let gotT = false;
  let front = [{ s: snap(player), d: 0, parent: null, move: null }], back = [];
  let n = 0;
  while (front.length || back.length) {
    if (!front.length) { front = back; back = []; }
    const node = front.pop();
    load(node.s);
    let comp = reach(st, node.s.player);
    // free pickups
    for (const id of comp) {
      if (R[id].key && !(st.keysTaken >> id & 1)) { st.keysTaken |= 1 << id; st.keys++; }
      if (id === tId) st.treasure = true;
    }
    for (const id of comp) roomsSeen.add(id);
    if (st.treasure) gotT = true;
    const canon = Math.min(...comp);
    const k = enc(canon);
    if (seen.has(k)) continue;
    seen.set(k, node);
    if (++n > cap) return { ok: false, capped: true, states: n, rooms: roomsSeen.size, gotT };
    if (st.treasure && comp.has(st.entry) && ladder(st, st.entry, 1).kind === 'sky') {
      const route = [];
      for (let q = node; q && q.move; q = q.parent) route.push(q.move);
      return { ok: true, turns: node.d, states: n, route: route.reverse(), rooms: roomsSeen.size };
    }
    const base = snap(canon);
    // unlock (free)
    for (const rm of R) {
      const id = rm.id;
      if (rm.lock >= 0 && !(st.unlocked >> id & 1) && st.keys > 0 && lockReachable(st, id, comp)) {
        const s2 = { ...base, at: base.at.slice(), pos: base.pos.slice(), ori: base.ori.slice(), unlocked: st.unlocked | (1 << id), keys: st.keys - 1, player: id };
        front.push({ s: s2, d: node.d, parent: node, move: { unlock: id } });
      }
    }
    // turns (cost 1)
    for (const id of comp) {
      if (!R[id].dial) continue;
      for (const dir of [1, -1]) {
        load(base);
        const L = layerOf(st, id);
        turn(st, L.axis, L.k, dir);
        back.push({ s: snap(id), d: node.d + 1, parent: node, move: { dial: id, axis: L.axis, k: L.k, dir } });
      }
    }
  }
  return { ok: false, states: n, rooms: roomsSeen.size, gotT };
}

export const solve = (vault, cap) => { const st = newState(vault); return solveFrom(st, st.entry, cap); };
