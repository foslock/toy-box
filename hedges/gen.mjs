// Builds levels.js: `node hedges/gen.mjs [tries]`
//
// Each room is a hand-placed layout of overlapping panels. Panels are solved in
// order on paper: for each one the generator picks an intended line given the
// hedges of everything before it, then adds garden symbols that line obeys until
// it is the only line that works. Overlapping panels are rechecked so a symbol
// added for a later panel never breaks an earlier one. Many seeds are tried per
// room and the one where the most panels *need* an earlier hedge wins.
import { writeFileSync } from 'node:fs';
import { key, ekey, hedgeSet, allLines, judge, regions, inRect, cellIn, exitDir, samePath, findLine } from './logic.js';

const TRIES = +process.argv[2] || 300;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (R, a) => a[Math.floor(R() * a.length)];

// ---- room layouts (vertex coords). kinds: which symbols the generator may add.
const SPECS = [
  { // 1. the entrance: draw a line, old hedges block, your line becomes a hedge
    w: 7, h: 5,
    fixed: [[[0, 4], [1, 4], [2, 4]], [[1, 2], [2, 2], [3, 2]]],
    panels: [
      { r: [0, 0, 3, 0], s: [0, 0], e: [3, 0], d: 'e', unique: false },
      { r: [0, 1, 3, 5], s: [0, 5], e: [3, 1], d: 'e', unique: false },
      { r: [5, 1, 5, 5], s: [5, 5], e: [5, 1], d: 'n', unique: false },
      { r: [4, 0, 7, 5], s: [4, 5], e: [7, 5], d: 's', unique: false },
    ],
  },
  { // 2. dots: the line must step on every stud (a hedge over a stud counts)
    w: 6, h: 6,
    panels: [
      { r: [0, 0, 2, 2], s: [0, 2], e: [2, 2], d: 's', dots: [[1, 0]], unique: false },
      { kinds: ['dots'] }, { kinds: ['dots'] }, { kinds: ['dots'] }, { kinds: ['dots'] },
    ],
  },
  { // 3. pebbles: white and slate may not share a lawn
    w: 6, h: 7,
    fixed: [[[1, 3], [1, 4], [1, 5]]],
    panels: [
      { r: [0, 0, 2, 1], s: [1, 1], e: [1, 0], d: 'n', stones: [[0, 0, 0], [1, 0, 1]], unique: false },
      { r: [0, 2, 2, 5], s: [0, 2], e: [2, 5], d: 's', stones: [[0, 3, 0], [1, 3, 1], [0, 4, 0], [1, 4, 1]], unique: false },
      { kinds: ['stones'] }, { kinds: ['stones'] }, { kinds: ['stones'] }, { kinds: ['stones'] },
    ],
  },
  { // 4. flowers: a flower's petals count the sides of its lawn that are line or hedge
    w: 6, h: 7,
    fixed: [[[1, 5], [2, 5]]],
    panels: [
      { r: [0, 0, 1, 1], s: [0, 1], e: [1, 1], d: 's', petals: [[0, 0, 3]], unique: false },
      { r: [0, 4, 3, 6], s: [0, 6], e: [3, 4], d: 'e', petals: [[1, 4, 2]], unique: false },
      { kinds: ['petals'] }, { kinds: ['petals'] }, { kinds: ['petals'] }, { kinds: ['petals'] },
    ],
  },
  { // 5. the centre: everything, then the whole room as one panel
    w: 6, h: 7,
    panels: [
      { kinds: ['dots', 'stones'] }, { kinds: ['stones', 'petals'] }, { kinds: ['petals', 'dots'] },
      { kinds: ['stones', 'dots', 'petals'] },
      { r: [0, 0, 6, 7], kinds: ['stones', 'petals', 'dots'], final: true },
    ],
  },
];

function touches(a, b) { // share any vertex
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

function boundary(r) {
  const out = [];
  for (let x = r[0]; x <= r[2]; x++) for (let y = r[1]; y <= r[3]; y++) if (x === r[0] || x === r[2] || y === r[1] || y === r[3]) out.push([x, y]);
  return out;
}

function chooseEnds(R, spec, ps, used, fixedV) {
  if (ps.s && ps.e) return { s: ps.s, e: ps.e, d: ps.d };
  const r = ps.r;
  const verts = [];
  for (let x = r[0]; x <= r[2]; x++) for (let y = r[1]; y <= r[3]; y++) verts.push([x, y]);
  for (let t = 0; t < 200; t++) {
    const s = pick(R, verts), e = pick(R, boundary(r));
    if (Math.abs(s[0] - e[0]) + Math.abs(s[1] - e[1]) < (ps.final ? 5 : 3)) continue;
    if (used.has(key(...s)) || used.has(key(...e)) || fixedV.has(key(...s)) || fixedV.has(key(...e))) continue;
    // exits face out of the panel; on a corner pick a side
    const opts = [];
    if (e[1] === r[1]) opts.push('n'); if (e[1] === r[3]) opts.push('s'); if (e[0] === r[0]) opts.push('w'); if (e[0] === r[2]) opts.push('e');
    return { s, e, d: pick(R, opts) };
  }
  return null;
}

const WHY = {};
const fail = (w) => { WHY[w] = (WHY[w] || 0) + 1; return null; };
function buildRoom(spec, seed) {
  const R = rng(seed);
  const room = { w: spec.w, h: spec.h, fixed: spec.fixed || [], panels: [], dots: [], stones: [], petals: [] };
  const fixedV = hedgeSet(room, []).verts;
  const used = new Set();
  const covered = new Set();
  const cells = (r) => { const o = []; for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) o.push(key(x, y)); return o; };
  const plist = [];
  for (const p0 of spec.panels) {
    let ps = p0;
    if (!ps.r) {
      let best = null, bs = -1;
      for (let t = 0; t < 40; t++) {
        const w = 2 + Math.floor(R() * 3), h = 2 + Math.floor(R() * 3);
        if (p0.final) { const r = [0, 0, spec.w, spec.h]; best = r; break; }
        if (w * h > 12 || w > spec.w || h > spec.h) continue;
        const x = Math.floor(R() * (spec.w - w + 1)), y = Math.floor(R() * (spec.h - h + 1));
        const r = [x, y, x + w, y + h], c = cells(r);
        // keep clear of the teaching panels; touch an earlier generated one
        if (plist.some((q) => q.unique === false && touches(q.r, r))) continue;
        if (plist.some((q) => q.unique !== false) && !plist.some((q) => q.unique !== false && touches(q.r, r))) continue;
        if (plist.some((q) => q.r.join() === r.join())) continue;
        const shared = Math.max(0, ...plist.map((q) => c.filter((k) => cells(q.r).includes(k)).length));
        if (shared > 4 && !p0.final) continue;
        const fresh = c.filter((k) => !covered.has(k)).length;
        const sc = fresh + (shared > 0 ? 3 : 0) + R() * 2;
        if (sc > bs) { bs = sc; best = r; }
      }
      if (!best) return fail('layout');
      ps = { ...ps, r: best };
    }
    plist.push(ps);
    for (const k of cells(ps.r)) covered.add(k);
  }
  spec = { ...spec, panels: plist };
  // hand-placed ends go down now; generated panels pick theirs when their turn comes
  for (const ps of spec.panels) {
    if (ps.s) { used.add(key(...ps.s)); used.add(key(...ps.e)); }
    room.panels.push({ r: ps.r, s: ps.s, e: ps.e, d: ps.d });
  }
  const sols = [], cache = [];
  const tryPanel = (k) => {
    const ps = spec.panels[k], panel = room.panels[k];
    const H = hedgeSet(room, sols);
    const tA = Date.now();
    const { lines, capped } = allLines(panel, H, ps.final ? 400000 : 100000);
    if (process.env.PROF) console.error(`seed ${seed} panel ${k} lines ${lines.length}${capped ? '+' : ''} ${Date.now() - tA}ms`);
    if (capped) return fail('capped' + k);
    // keep off the hand-placed starts and exits still to come
    const later = new Set();
    room.panels.forEach((p, j) => { if (j > k && p.s) { later.add(key(...p.s)); later.add(key(...p.e)); } });
    const clean = lines.filter((l) => l.every(([x, y]) => !later.has(key(x, y))));
    cache[k] = { H, lines: clean, unique: ps.unique };
    let valid = clean.filter((l) => judge(room, panel, l, H).ok);
    if (!valid.length) return fail('novalid' + k);
    // a generated panel has to offer real choices before its symbols go down
    if (process.env.PROF) console.error('k', k, JSON.stringify(panel), 'lines', lines.length, 'clean', clean.length, 'valid', valid.length);
    if (ps.kinds && valid.length < (ps.final ? 6 : 5)) return fail('trivial' + k);
    // a longer, turnier line makes a better puzzle
    const dotsOnly = (ps.kinds || []).every((t) => t === 'dots');
    const weight = (l) => l.length ** (dotsOnly ? 4 : 2) * (1 + turns(l));
    // the line must leave every later panel it touches something to work with
    // (its ends aren't chosen yet, so ask for plenty of open, joined-up ground)
    const ahead = (l) => room.panels.every((p, j) => {
      if (j <= k || !touches(p.r, panel.r) || spec.panels[j].final) return true;
      const H2 = hedgeSet(room, [...sols, l]);
      if (p.s) return findLine(room, p, H2, 4000) !== null;
      return roomy(p.r, H2);
    });
    valid = valid.filter(ahead);
    if (!valid.length) return fail('ahead' + k);
    let target = weighted(R, valid, weight);
    if (ps.unique !== false) {
      // narrow down to one line, or a few when only dots are allowed (dots alone
      // can't rule out a line that takes in extra ground)
      const enough = 8;
      let added = 0, free = 2;
      while (valid.length > 1) {
        const cands = candidates(room, panel, target, H, ps.kinds || [], R);
        let best = null, bestN = Infinity;
        for (const c of shuffle(R, cands).slice(0, ps.final ? 24 : 60)) {
          apply(room, c, 1);
          const n = valid.filter((l) => judge(room, panel, l, H).ok).length;
          const fine = (n < valid.length || free > 0) && earlierOk(room, sols, cache, k) && ahead(target);
          apply(room, c, -1);
          if (fine && (n < bestN || (n === bestN && R() < 0.5))) { best = c; bestN = n; }
        }
        if (!best) { if (valid.length <= enough) break; return fail('nocand' + k); }
        // a lone pebble rules nothing out; it takes a second to start a contest
        if (bestN >= valid.length) free--;
        apply(room, best, 1);
        valid = valid.filter((l) => judge(room, panel, l, H).ok && ahead(l));
        if (++added > (ps.final ? 10 : 7)) { if (valid.length <= enough) break; return fail('many' + k); }
      }
      if (ps.kinds && added < 2) {
        // too easy: one symbol settled it. Ask for a second that still keeps the line
        const c2 = shuffle(R, candidates(room, panel, target, H, ps.kinds, R)).find((c) => { apply(room, c, 1); const ok = earlierOk(room, sols, cache, k) && ahead(target); apply(room, c, -1); return ok; });
        if (!c2) return fail('thin' + k);
        apply(room, c2, 1); valid = valid.filter((l) => judge(room, panel, l, H).ok);
      }
    }
    return target;
  };
  for (let k = 0; k < spec.panels.length; k++) {
    const ps = spec.panels[k];
    for (const d of ps.dots || []) room.dots.push(d);
    for (const s of ps.stones || []) room.stones.push(s);
    for (const p of ps.petals || []) room.petals.push(p);
    // a panel that won't come right gets new ends and another go before the room is dropped
    let target = null;
    for (let attempt = 0; attempt < 20 && !target; attempt++) {
      const snap = { dots: room.dots.slice(), stones: room.stones.slice(), petals: room.petals.slice() };
      if (!(ps.s && ps.e)) {
        const p = room.panels[k];
        if (p.s) { used.delete(key(...p.s)); used.delete(key(...p.e)); }
        const hv = hedgeSet(room, sols).verts;
        const ends = chooseEnds(R, spec, ps, new Set([...used, ...hv]), fixedV);
        if (!ends) break;
        room.panels[k] = { r: ps.r, s: ends.s, e: ends.e, d: ends.d };
        used.add(key(...ends.s)); used.add(key(...ends.e));
      }
      target = tryPanel(k);
      if (!target) Object.assign(room, snap);
      if (ps.s && ps.e && !target) break;
    }
    if (!target) return null;
    sols.push(target);
  }
  // a line other than the intended one must never strand a later panel
  for (let k = 0; k < room.panels.length; k++) {
    const { H, lines } = cache[k];
    const alts = lines.filter((l) => judge(room, room.panels[k], l, H).ok && !samePath(l, sols[k]));
    if (spec.panels[k].unique !== false && alts.length > 9) return fail('loose' + k);
    for (const alt of alts) for (let j = k + 1; j < room.panels.length; j++) {
      if (!touches(room.panels[k].r, room.panels[j].r)) continue;
      const s2 = sols.slice(0, j); s2[k] = alt;
      const H2 = hedgeSet(room, s2);
      if (!allLines(room.panels[j], H2, 100000).lines.some((l) => judge(room, room.panels[j], l, H2).ok)) return fail('strand' + k + '>' + j);
    }
  }
  return { room, sols, spec };
}

function roomy(r, H) {
  const free = [];
  for (let x = r[0]; x <= r[2]; x++) for (let y = r[1]; y <= r[3]; y++) if (!H.verts.has(key(x, y))) free.push(key(x, y));
  const n = (r[2] - r[0] + 1) * (r[3] - r[1] + 1);
  if (free.length < n * 0.45) return false;
  const set = new Set(free), seen = new Set([free[0]]), st = [free[0]];
  while (st.length) { const k = st.pop(); for (const d of [1, -1, 64, -64]) if (set.has(k + d) && !seen.has(k + d)) { seen.add(k + d); st.push(k + d); } }
  return seen.size >= n * 0.4;
}

function turns(l) { let t = 0; for (let i = 2; i < l.length; i++) if ((l[i][0] - l[i - 1][0]) !== (l[i - 1][0] - l[i - 2][0])) t++; return t; }
function weighted(R, arr, w) {
  const ws = arr.map(w), tot = ws.reduce((a, b) => a + b, 0);
  let x = R() * tot;
  for (let i = 0; i < arr.length; i++) if ((x -= ws[i]) <= 0) return arr[i];
  return arr[arr.length - 1];
}
function shuffle(R, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function apply(room, c, sign) {
  const list = room[c.kind];
  if (sign > 0) list.push(c.v); else list.splice(list.indexOf(c.v), 1);
}

function candidates(room, panel, target, H, kinds, R) {
  const r = panel.r, out = [];
  const lv = new Set(target.map(([x, y]) => key(x, y)));
  const le = new Set(); for (let i = 1; i < target.length; i++) le.add(ekey(...target[i - 1], ...target[i]));
  const eOn = (k) => le.has(k) || H.edges.has(k);
  const taken = new Set([...room.stones, ...room.petals].map(([x, y]) => key(x, y)));
  const dotted = new Set(room.dots.map(([x, y]) => key(x, y)));
  if (kinds.includes('dots')) for (const [x, y] of target) if (!dotted.has(key(x, y)) && !H.verts.has(key(x, y))) out.push({ kind: 'dots', v: [x, y] });
  const reg = regions(r, eOn);
  const col = new Map();
  for (const [cx, cy, c] of room.stones) if (cellIn(r, cx, cy)) col.set(reg.get(key(cx, cy)), c);
  for (let cy = r[1]; cy < r[3]; cy++) for (let cx = r[0]; cx < r[2]; cx++) {
    if (taken.has(key(cx, cy))) continue;
    if (kinds.includes('stones')) {
      const g = reg.get(key(cx, cy));
      if (col.has(g)) out.push({ kind: 'stones', v: [cx, cy, col.get(g)] });
      else { out.push({ kind: 'stones', v: [cx, cy, 0] }); out.push({ kind: 'stones', v: [cx, cy, 1] }); }
    }
    if (kinds.includes('petals')) {
      const n = eOn(ekey(cx, cy, cx + 1, cy)) + eOn(ekey(cx, cy + 1, cx + 1, cy + 1)) + eOn(ekey(cx, cy, cx, cy + 1)) + eOn(ekey(cx + 1, cy, cx + 1, cy + 1));
      if (n >= 1 && n <= 3) out.push({ kind: 'petals', v: [cx, cy, n] });
    }
  }
  return out;
}

// every earlier panel still has its intended line, and only that line if it was unique
function earlierOk(room, sols, cache, k) {
  for (let j = 0; j < k; j++) {
    const { H, lines } = cache[j], p = room.panels[j];
    if (!judge(room, p, sols[j], H).ok) return false;
  }
  return true;
}

// how many panels can't be solved without a particular earlier hedge
function dependencies(spec, room, sols) {
  let deps = 0;
  const notes = [];
  for (let k = 1; k < room.panels.length; k++) {
    const need = [];
    for (let j = 0; j < k; j++) {
      if (!touches(room.panels[j].r, room.panels[k].r)) continue;
      const others = sols.slice(0, k).filter((_, i) => i !== j);
      const H = hedgeSet(room, others);
      const ok = allLines(room.panels[k], H, 100000).lines.some((l) => judge(room, room.panels[k], l, H).ok);
      if (!ok) need.push(j);
    }
    if (need.length) deps++;
    notes.push(`${k}<-[${need}]`);
  }
  return { deps, notes };
}

function count(room) { return room.dots.length + room.stones.length + room.petals.length; }

if (process.argv[1] && !process.argv[1].endsWith('gen.mjs')) throw new Error('gen.mjs is a script');
// `node gen.mjs 300 5` rebuilds only room 5 and keeps the rest of levels.js
const only = process.argv[3] ? process.argv[3].split(',').map((n) => +n - 1) : null;
const out = only ? (await import('./levels.js')).ROOMS.slice() : [];
SPECS.forEach((spec, i) => {
  if (only && !only.includes(i)) return;
  let best = null;
  const tries = spec.panels.some((p) => p.final) ? TRIES * 3 : TRIES;
  for (let t = 0; t < tries; t++) {
    const res = buildRoom(spec, 1000 * (i + 1) + t);
    if (!res) continue;
    const dep = dependencies(res.spec, res.room, res.sols);
    const score = dep.deps * 10 - count(res.room) * 0.6 + res.sols.reduce((a, l) => a + l.length, 0) * 0.1;
    if (!best || score > best.score) best = { ...res, ...dep, score, seed: t };
  }
  if (!best) { console.log(`room ${i + 1}: no layout found`, WHY); process.exit(1); }
  console.log(`room ${i + 1}: seed ${best.seed} score ${best.score.toFixed(1)} deps ${best.deps} symbols ${count(best.room)} ${best.notes.join(' ')}`);
  console.log(trace(best.room, best.sols));
  out[i] = { ...best.room, sols: best.sols };
});

writeFileSync(new URL('./levels.js', import.meta.url),
  `// generated by gen.mjs: node hedges/gen.mjs\nexport const ROOMS = ${JSON.stringify(out)};\n`);

export function trace(room, sols) {
  // ASCII: vertices '+', solved lines 'o', symbols in cells
  const W = room.w * 2 + 1, Hh = room.h * 2 + 1;
  const g = Array.from({ length: Hh }, (_, y) => Array.from({ length: W }, (_, x) => (x % 2 === 0 && y % 2 === 0 ? '·' : ' ')));
  const H = hedgeSet(room, sols);
  const fx = hedgeSet(room, []);
  for (const p of [...room.fixed, ...sols]) for (let i = 0; i < p.length; i++) {
    const ch = room.fixed.includes(p) ? '#' : String.fromCharCode(97 + sols.indexOf(p));
    g[p[i][1] * 2][p[i][0] * 2] = ch;
    if (i) g[p[i][1] + p[i - 1][1]][p[i][0] + p[i - 1][0]] = ch;
  }
  room.panels.forEach((p, i) => { g[p.s[1] * 2][p.s[0] * 2] = String(i + 1); });
  for (const [x, y] of room.dots) g[y * 2][x * 2] = '*';
  for (const [x, y, c] of room.stones) g[y * 2 + 1][x * 2 + 1] = c ? '●' : '○';
  for (const [x, y, n] of room.petals) g[y * 2 + 1][x * 2 + 1] = '₀₁₂₃'[n];
  return g.map((r) => r.join('')).join('\n');
}
