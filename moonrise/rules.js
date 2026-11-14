// Moonrise Manor: the rules. No DOM in here, so sim.mjs can play whole games headless.
//
// You are Mr Fenwick, a guest at the manor for five nights, and the werewolf.
// Each night every guest is in one of nine rooms. You pick a guest who is alone
// and a room next door to lurk in; at midnight you slip through the door.
// Each day at dinner everyone says where they were. Honest guests name who was
// in the room with them, so a lie can be contradicted on the spot, and some
// evidence (the doctor's report, the Colonel's memory) turns up a day later.

export const ROOMS = [
  { id: 'library', name: 'Library' },
  { id: 'gallery', name: 'Gallery' },
  { id: 'chapel', name: 'Chapel' },
  { id: 'study', name: 'Study' },
  { id: 'hall', name: 'Great Hall' },
  { id: 'conserv', name: 'Conservatory' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'cellar', name: 'Wine Cellar' },
  { id: 'billiard', name: 'Billiard Room' },
];
export const RI = Object.fromEntries(ROOMS.map((r, i) => [r.id, i]));
export const N_NIGHTS = 5;
export const EXILE_VOTES = 3;      // fewest votes that lock someone in the ice house
export const VOTE_FLOOR = 3;       // a guest abstains unless someone scores this much
export const SWEAR = 3;            // how much a sworn accusation weighs (times your trust)
// fewest votes that lock someone away: three while the table is big, two once few are left
export const exileVotes = g => g.alive.length >= 4 ? EXILE_VOTES : 2;

export function adjacent(a, b) {
  return Math.abs((a / 3 | 0) - (b / 3 | 0)) + Math.abs(a % 3 - b % 3) === 1;
}
export function neighbours(a) { return ROOMS.map((_, i) => i).filter(i => adjacent(a, i)); }

export const YOU = 'you';
export const PEOPLE = {
  you: { id: 'you', name: 'Mr Fenwick', short: 'Fenwick', trait: 'The new tenant of the Dower House. A wolf when the moon is up.' },
};
export const GUESTS = [
  { id: 'colonel', name: 'Colonel Brack', short: 'the Colonel',
    trait: 'Dozes off after his port, and would never admit it. If you lurk in his room he will swear you were there all night.',
    haunts: { billiard: 6, study: 3, hall: 1 }, sleeper: true },
  { id: 'reverend', name: 'Reverend Pell', short: 'the Reverend',
    trait: 'Votes however the Colonel votes.',
    haunts: { chapel: 6, library: 1, gallery: 1 } },
  { id: 'ada', name: 'Miss Ada Vane', short: 'Ada',
    trait: 'Never apart from her twin, Ida. While both live, neither is ever alone, and the table won\'t take a sister\'s word as an alibi.',
    haunts: { gallery: 3, library: 2, conserv: 2, hall: 2 }, twin: 'ida' },
  { id: 'ida', name: 'Miss Ida Vane', short: 'Ida',
    trait: 'Votes exactly as Ada does.',
    haunts: { gallery: 3, library: 2, conserv: 2, hall: 2 }, twin: 'ada' },
  { id: 'cook', name: 'Mrs Hobb', short: 'Mrs Hobb',
    trait: 'Hears through walls. She knows which rooms next to hers had someone in them, and which were silent.',
    haunts: { kitchen: 7, cellar: 1, hall: 1 }, ears: true },
  { id: 'doctor', name: 'Dr Quill', short: 'Dr Quill',
    trait: 'Studies each body for a day, then names the room the beast came from.',
    haunts: { library: 4, study: 3, conserv: 1 }, doctor: true },
  { id: 'widow', name: 'Lady Marrow', short: 'Lady Marrow',
    trait: 'Sneaks down to the Wine Cellar most nights, and always swears she was alone in the Conservatory.',
    haunts: { cellar: 6, conserv: 4 }, liar: true },
  { id: 'poet', name: 'Mr Lark', short: 'Mr Lark',
    trait: 'Drunk by ten. Notices nothing, vouches for no one, and nobody trusts a word he says.',
    haunts: { library: 1, gallery: 1, chapel: 1, study: 1, hall: 1, conserv: 1, kitchen: 1, cellar: 1, billiard: 1 }, drunk: true },
];
export const G = Object.fromEntries(GUESTS.map(g => [g.id, g]));
for (const g of GUESTS) PEOPLE[g.id] = g;
export const nameOf = id => PEOPLE[id].name;
export const shortOf = id => PEOPLE[id].short;

// ------------------------------------------------------------------ randomness
// State is plain data (the rng is a number) so a game can be cloned for look-ahead.
export function rnd(g) {
  let t = (g.rs = (g.rs + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (g, arr) => arr[Math.floor(rnd(g) * arr.length)];
function weighted(g, table) {
  const ents = Object.entries(table);
  let tot = 0; for (const [, w] of ents) tot += w;
  let r = rnd(g) * tot;
  for (const [k, w] of ents) { r -= w; if (r <= 0) return k; }
  return ents[ents.length - 1][0];
}
export const clone = g => JSON.parse(JSON.stringify(g));

// ------------------------------------------------------------------ marks: why the table suspects someone
// Each person carries a tally. score() turns it into the public suspicion.
const W = { lies: 10, conflicts: 5, leaving: 20, doctor: 8, recall: 12, falseSwear: 6, petty: .5, swore: .5, unverAdj: 1.5, unverFar: .5, hint: .5 };
function blankMarks() {
  return { lies: 0, conflicts: 0, leaving: 0, doctor: 0, recall: 0, falseSwear: 0, petty: 0, swore: 0,
    unverAdj: 0, unverFar: 0, hint: 0, accused: 0, doubted: 0, remarks: 0 };
}
export function score(g, id) {
  const m = g.marks[id];
  let s = m.accused + m.doubted + m.remarks * .5;
  for (const k in W) s += W[k] * m[k];
  if (vouchedNights(g, id)) s -= VOUCH_CREDIT;
  return s;
}
export function trust(g, id) {
  const m = g.marks[id];
  const base = id === 'poet' ? .3 : 1;
  return base / (1 + .6 * (m.lies + m.conflicts + m.falseSwear));
}

// ------------------------------------------------------------------ game
export function newGame(seed = 1, opts = {}) {
  const g = {
    seed, rs: seed | 0, n: 0, phase: 'night',
    alive: GUESTS.map(x => x.id),
    fate: {},                       // id -> { kind: 'killed'|'exiled', n }
    nights: [],
    marks: { you: blankMarks() },
    cleared: {},                    // id -> night it was proven (guests' view)
    confirmations: {},              // `${n}:${id}` -> [witness ids]
    bias: {},
    sworn: [],                      // your sworn accusations { n, target }
    recalls: [],                    // nights the Colonel vouched for you while asleep
    over: null,
    tutorial: !!opts.tutorial,
  };
  for (const x of GUESTS) g.marks[x.id] = blankMarks();
  for (const a of GUESTS) {
    g.bias[a.id] = {};
    for (const b of [YOU, ...GUESTS.map(x => x.id)]) g.bias[a.id][b] = rnd(g) * 1.6;
  }
  startNight(g);
  return g;
}

export const isAlive = (g, id) => id === YOU ? !g.over || g.over.win : g.alive.includes(id);

// Hand-placed first night for the lesson, so every point it makes is on the board.
const LESSON_NIGHT = { colonel: 'billiard', reverend: 'chapel', ada: 'library', ida: 'library', cook: 'kitchen', doctor: 'study', widow: 'cellar', poet: 'gallery' };

export function startNight(g) {
  g.n += 1; g.phase = 'night';
  let pos;
  if (g.tutorial && g.n === 1) pos = { ...LESSON_NIGHT };
  else {
    for (let tries = 0; tries < 40; tries++) {
      pos = {};
      for (const id of g.alive) {
        const x = G[id];
        if (x.twin && pos[x.twin] && g.alive.includes(x.twin)) { pos[id] = pos[x.twin]; continue; }
        pos[id] = weighted(g, x.haunts);
      }
      if (aloneGuests(g, pos).length) break;
    }
    if (!aloneGuests(g, pos).length) {    // nobody alone: Mr Lark wanders off somewhere empty
      const w = g.alive.includes('poet') ? 'poet' : g.alive.find(id => !G[id].twin) || g.alive[0];
      const used = new Set(Object.values(pos));
      pos[w] = ROOMS.map(r => r.id).find(r => !used.has(r));
    }
  }
  const room = {}; for (const id in pos) room[id] = RI[pos[id]];
  g.nights.push({ n: g.n, room, lurk: null, victim: null, vroom: null, claims: {}, lists: {}, heard: null, doctorRoom: null, said: [] });
  return g.nights[g.n - 1];
}

export const night = g => g.nights[g.n - 1];
export function occupants(g, r, nt = night(g)) { return g.alive.filter(id => nt.room[id] === r); }
function aloneGuests(g, pos) {
  return g.alive.filter(id => g.alive.filter(o => pos[o] === pos[id]).length === 1);
}
export function canTake(g, id) {
  const nt = night(g);
  return g.alive.includes(id) && occupants(g, nt.room[id]).length === 1;
}
export function lurkRooms(g, victim) {
  return neighbours(night(g).room[victim]);
}
// What happens if you lurk in room r tonight (for the night panel's warnings).
export function lurkReport(g, r) {
  const nt = night(g);
  const here = occupants(g, r);
  // Lady Marrow won't admit to the cellar, so she can't say she saw you leave it
  const mum = here.filter(id => G[id].liar && r !== RI.conserv);
  const awake = here.filter(id => !G[id].sleeper && !G[id].drunk && !mum.includes(id));
  const cookId = g.alive.includes('cook') ? 'cook' : null;
  const heardBy = cookId && adjacent(nt.room.cook, r) && !(nt.room.cook === r) ? 'cook' : null;
  return { here, awake, mum, colonel: here.includes('colonel'), poet: here.includes('poet'), heardBy };
}

export function hunt(g, lurk, victim) {
  const nt = night(g);
  if (!canTake(g, victim)) throw new Error('victim not alone');
  if (!adjacent(lurk, nt.room[victim])) throw new Error('not next door');
  nt.lurk = lurk; nt.victim = victim; nt.vroom = nt.room[victim];
  g.alive = g.alive.filter(id => id !== victim);
  g.fate[victim] = { kind: 'killed', n: g.n };
  g.phase = 'dawn';
}

// ------------------------------------------------------------------ dawn
// Returns lines: { who, text, kind, mark? }  who = guest id | 'you' | null (narrator)
export function dawn(g) {
  const nt = night(g), L = [];
  L.push({ who: null, kind: 'body', text: `${nameOf(nt.victim)} is found dead in the ${ROOMS[nt.vroom].name}.` });
  if (nt.victim === 'widow' && nt.vroom === RI.cellar) L.push({ who: 'cook', text: 'In the Wine Cellar? So it was her at the port all along.' });
  if (nt.victim === 'ada' || nt.victim === 'ida') {
    const other = nt.victim === 'ada' ? 'ida' : 'ada';
    if (g.alive.includes(other)) L.push({ who: other, text: 'I only left her for a minute. A minute!' });
  }
  // a sworn accusation that the beast's own kill disproves
  for (const s of g.sworn) if (s.target === nt.victim && !s.undone) {
    s.undone = true; g.marks.you.falseSwear++;
    L.push({ who: speakerFor(g, ['doctor', 'colonel', 'cook', 'reverend', 'ada']), kind: 'refute', mark: 'you',
      text: `Fenwick swore ${shortOf(nt.victim)} was the one creeping about. Now the beast has had ${shortOf(nt.victim)} too.` });
  }
  // the doctor's report on yesterday's body
  if (g.n === 1 && g.alive.includes('doctor')) {
    L.push({ who: 'doctor', text: 'I shall sit with the body today. By tomorrow the wounds will tell me which room the beast came from.' });
  } else if (g.n > 1) {
    const prev = g.nights[g.n - 2];
    if (g.alive.includes('doctor')) {
      prev.doctorRoom = prev.lurk;
      const R = ROOMS[prev.lurk].name;
      L.push({ who: 'doctor', kind: 'clue', text: `I have finished with poor ${shortOf(prev.victim)}. The marks are plain: the beast came through the door from the ${R}.` });
      const claimers = Object.keys(prev.claims).filter(id => prev.claims[id] === prev.lurk && isAlive(g, id));
      if (claimers.length) {
        for (const id of claimers) {
          g.marks[id].doctor++;
          revoke(g, prev.n, id);
          L.push({ who: speakerFor(g, ['colonel', 'cook', 'ada', 'reverend'], id), kind: 'refute', mark: id,
            text: `${id === YOU ? 'Fenwick' : shortOf(id)} told us they spent that night in the ${R}.` });
        }
      } else {
        L.push({ who: speakerFor(g, ['cook', 'colonel', 'ada']), kind: 'hint', text: `Nobody said they were in the ${R} that night. Somebody lied to us.` });
        for (const id of unverifiedOn(g, prev.n)) if (isAlive(g, id)) g.marks[id].hint++;
      }
    } else if (!g.doctorMourned && g.fate.doctor) {
      g.doctorMourned = true;
      L.push({ who: null, text: 'With Dr Quill gone, nobody can read the wounds.' });
    }
  }
  // the Colonel's memory
  if (g.alive.includes('colonel')) {
    for (const r of g.recalls) if (!r.done && rnd(g) < .3) {
      r.done = true; g.marks.you.recall++; revoke(g, r.n, YOU);
      L.push({ who: 'colonel', kind: 'refute', mark: 'you',
        text: `Been thinking about night ${roman(r.n)}. I may have nodded off. And when I woke, Fenwick's chair was empty.` });
      break;
    }
  }
  g.phase = 'claim';
  return L;
}

function speakerFor(g, prefs, not) {
  for (const id of prefs) if (g.alive.includes(id) && id !== not) return id;
  return g.alive.find(id => id !== not && id !== 'poet') || null;
}
export const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][n] || String(n);

function revoke(g, n, id) {
  const k = `${n}:${id}`;
  if (g.confirmations[k]) { delete g.confirmations[k]; recomputeCleared(g); }
}
// One night vouched for: trusted (counts against suspicion). Two nights: above suspicion.
export const CLEAR_NIGHTS = 2, VOUCH_CREDIT = 4;
function recomputeCleared(g) {
  g.cleared = {}; g.vouched = {};
  for (const k in g.confirmations) {
    const [n, id] = k.split(':');
    (g.vouched[id] ||= []).push(+n);
  }
  for (const id in g.vouched) if (g.vouched[id].length >= CLEAR_NIGHTS) g.cleared[id] = Math.max(...g.vouched[id]);
}
export const vouchedNights = (g, id) => (g.vouched && g.vouched[id] || []).length;
export const isCleared = (g, id) => id in g.cleared;
function unverifiedOn(g, n) {
  const nt = g.nights[n - 1];
  return Object.keys(nt.claims).filter(id => !g.confirmations[`${n}:${id}`]);
}

// ------------------------------------------------------------------ dinner testimony
// Who would truthfully say they saw whom tonight.
function trueList(g, id) {
  const nt = night(g);
  const r = nt.room[id];
  const list = g.alive.filter(o => o !== id && nt.room[o] === r);
  if (nt.lurk === r) list.push(YOU);
  return list;
}
// Rooms you may claim: not the one where the body was found.
export function claimable(g) { const nt = night(g); return ROOMS.map((_, i) => i).filter(i => i !== nt.vroom); }

// Speakers in seat order (alive guests). You answer first.
export function seatOrder(g) { return GUESTS.map(x => x.id).filter(id => g.alive.includes(id)); }

export function testimony(g, claim) {
  const nt = night(g), L = [];
  const order = [YOU, ...seatOrder(g)];
  const claims = nt.claims, lists = nt.lists;
  const spoke = [];
  const said = (who, text, kind, mark) => L.push({ who, text, kind, mark });
  const cookAt = g.alive.includes('cook') ? nt.room.cook : null;
  let silent = [], heard = [];
  if (cookAt != null) {
    for (const r of neighbours(cookAt)) {
      const occ = g.alive.some(o => nt.room[o] === r) || nt.lurk === r || nt.vroom === r;
      (occ ? heard : silent).push(r);
    }
    nt.heard = { at: cookAt, heard, silent };
  }
  const refuted = new Set();

  for (const id of order) {
    // --- what they claim and who they name
    let room, list = [], vouch = false;
    if (id === YOU) { room = claim; list = []; }
    else {
      const x = G[id];
      room = nt.room[id];
      if (x.liar && room !== RI.conserv) { room = RI.conserv; list = []; }
      else if (x.drunk) list = [];
      else list = trueList(g, id);
      vouch = !x.drunk;
    }
    claims[id] = room; lists[id] = list;
    said(id, claimLine(g, id, room, list), 'claim');

    if (id !== YOU) {
      // seen leaving: awake people in your lurk room saw you go out
      const x = G[id];
      if (list.includes(YOU) && !x.sleeper && !x.drunk && nt.room[id] === nt.lurk && !refuted.has('seenLeaving')) {
        refuted.add('seenLeaving');
        g.marks.you.leaving++;
        said(id, `Fenwick sat with us in the ${ROOMS[room].name}, until midnight. Then Fenwick slipped out, and was gone a good while.`, 'refute', YOU);
      }
      // the Colonel names you: you must have claimed his room
      if (x.sleeper && list.includes(YOU)) {
        if (claims.you === room) { addConfirm(g, YOU, id); g.recalls.push({ n: g.n }); }
        else { refuted.add(YOU); g.marks.you.lies++; said(id, `Eh? Fenwick was in the ${ROOMS[room].name} with me, not the ${ROOMS[claims.you].name}. Saw him come in.`, 'refute', YOU); }
      }
    }

    // --- check against everyone who spoke before
    for (const p of spoke) {
      if (claims[p] !== room) {
        // q names p as being in q's room, but p claimed elsewhere
        if (vouch && list.includes(p) && p !== YOU && !refuted.has(p)) {
          refuted.add(p); g.marks[p].lies++;
          said(id, `${shortCap(p)} was with me in the ${ROOMS[room].name}. Why say otherwise?`, 'refute', p);
        }
        continue;
      }
      checkPair(g, p, id, said, refuted);
    }
    // the cook's ears: anyone claiming a room she heard as silent
    if (id === 'cook' && cookAt != null) {
      said('cook', earsLine(heard, silent), 'ears');
      for (const p of spoke) if (silent.includes(claims[p]) && !refuted.has(p)) {
        refuted.add(p); g.marks[p].lies++;
        said('cook', `${shortCap(p)} says the ${ROOMS[claims[p]].name}? There wasn't a soul in there. I'd have heard.`, 'refute', p);
      }
    } else if (cookAt != null && spoke.includes('cook') && silent.includes(room) && !refuted.has(id)) {
      refuted.add(id); g.marks[id].lies++;
      said('cook', `The ${ROOMS[room].name}? Nobody was in there. I'd have heard.`, 'refute', id);
    }
    spoke.push(id);
  }

  // confirmations from honest, awake-seeming witnesses (the Colonel counts, Mr Lark doesn't)
  for (const id of order) {
    if (id === YOU) continue;
    const x = G[id];
    if (x.drunk) continue;
    for (const p of lists[id]) if (p !== YOU && claims[p] === claims[id] && !refuted.has(p) && x.twin !== p) addConfirm(g, p, id);
  }
  // rooms the cook heard that nobody owned up to
  if (cookAt != null) {
    for (const r of heard) {
      if (r === nt.vroom) continue;
      if (!Object.values(claims).includes(r)) {
        said('cook', `Somebody was in the ${ROOMS[r].name} last night, and they haven't said so.`, 'hint');
        for (const id of order) if (!g.confirmations[`${g.n}:${id}`]) g.marks[id].hint++;
      }
    }
  }
  // the beast strikes through a connecting door: unvouched people next to the body
  for (const id of order) {
    if (g.confirmations[`${g.n}:${id}`]) continue;
    if (adjacent(claims[id], nt.vroom)) g.marks[id].unverAdj++;
    else g.marks[id].unverFar++;
  }
  refuted.delete('seenLeaving');
  nt.refuted = [...refuted];
  g.phase = 'remark';
  return L;
}

function checkPair(g, p, q, said, refuted) {
  // p and q claim the same room. An honest, awake witness names everyone they saw.
  const nt = night(g), room = nt.claims[p];
  const pq = vouches(g, q) && !nt.lists[q].includes(p);
  const qp = vouches(g, p) && !nt.lists[p].includes(q);
  if (!pq && !qp) return;
  const qTrue = q !== YOU && nt.room[q] === room;
  const pTrue = p !== YOU && nt.room[p] === room;
  if (pq && qp) {           // they deny each other
    if (pTrue && !qTrue) { refute(g, q, p, room, said, refuted); return; }
    if (qTrue && !pTrue) { refute(g, p, q, room, said, refuted); return; }
    g.marks[p].conflicts++; g.marks[q].conflicts++;
    said(q, `I was alone in the ${ROOMS[room].name}. ${shortCap(p)} was nowhere near it.`, 'conflict', p);
    said(p === YOU ? null : p, `${p === YOU ? 'You insist' : shortCap(p) + ' insists'} it's the other way round. One of you is lying.`, 'conflict', q);
    return;
  }
  if (pq) refute(g, p, q, room, said, refuted); else refute(g, q, p, room, said, refuted);
}
function refute(g, liar, witness, room, said, refuted) {
  if (refuted.has(liar) || refuted.has(witness)) return;
  // someone else honest saw the 'liar' there: then it's the witness who is lying
  const nt = night(g);
  if (liar !== YOU) {
    const backed = Object.keys(nt.claims).some(w => w !== witness && w !== liar && w !== YOU && !G[w].drunk && nt.claims[w] === room && nt.room[w] === room && nt.lists[w].includes(liar));
    if (backed && witness !== YOU) { [liar, witness] = [witness, liar]; if (refuted.has(liar)) return; }
  }
  refuted.add(liar); g.marks[liar].lies++;
  said(witness, `${shortCap(liar)} was not in the ${ROOMS[room].name}. I was there all evening.`, 'refute', liar);
}
function vouches(g, id) { return id !== YOU && !G[id].drunk; }
function addConfirm(g, p, w) {
  const k = `${g.n}:${p}`;
  (g.confirmations[k] ||= []).includes(w) || g.confirmations[k].push(w);
  recomputeCleared(g);
}
const shortCap = id => { const s = id === YOU ? 'Fenwick' : shortOf(id); return s[0].toUpperCase() + s.slice(1); };

const capFirst = s => s[0].toUpperCase() + s.slice(1);
function listNames(list) {
  const n = list.map(id => id === YOU ? 'Fenwick' : shortOf(id));
  if (n.length === 1) return n[0];
  return n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}
function claimLine(g, id, room, list) {
  const R = ROOMS[room].name;
  const others = list.filter(x => x !== YOU);
  const w = others.length ? listNames(others) : '';
  switch (id) {
    case YOU: return `I was in the ${R}.`;
    case 'colonel': return list.length ? `Took my port in the ${R}. ${capFirst(listNames(list))} kept me company.` : `Took my port in the ${R}, as ever. Had the place to myself.`;
    case 'reverend': return list.length ? `I kept vigil in the ${R}, with ${listNames(list)}.` : `I kept vigil in the ${R}. Alone, with my prayers.`;
    case 'ada': return list.length ? `${capFirst(listNames(list))} and I sat up in the ${R}.` : `I was in the ${R}. On my own.`;
    case 'ida': return list.length ? `We sat up in the ${R}, ${listNames(list)} and I.` : `The ${R}. By myself.`;
    case 'cook': return list.length ? `In the ${R}, with ${listNames(list)} under my feet.` : `In the ${R}, where else.`;
    case 'doctor': return list.length ? `The ${R}, with my notes. ${capFirst(listNames(list))} can say so.` : `The ${R}, with my notes. Alone, I'm afraid.`;
    case 'widow': return list.length ? `The ${R}, with ${listNames(list)}.` : `The ${R}. Alone, with my grief.`;
    case 'poet': return `I was in the... ${R}? Yes. The ${R}. Probably.`;
  }
  return `I was in the ${R}${w ? ' with ' + w : ''}.`;
}
function earsLine(heard, silent) {
  const h = heard.map(r => ROOMS[r].name), s = silent.map(r => ROOMS[r].name);
  let t = '';
  if (h.length) t += `I heard someone moving about in the ${joinOr(h, 'and')}. `;
  if (s.length) t += `The ${joinOr(s, 'and the')} ${s.length > 1 ? 'were' : 'was'} quiet as the grave.`;
  return t.trim();
}
const joinOr = (a, w) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ` ${w} ` + a[a.length - 1];

// ------------------------------------------------------------------ your remark
// kind: 'quiet' | 'doubt' | 'swear'
export function remarkTargets(g) { return seatOrder(g); }
export function remark(g, kind, target) {
  const nt = night(g), L = [];
  const confirmed = target && g.confirmations[`${g.n}:${target}`];
  if (kind === 'doubt') {
    L.push({ who: YOU, text: `Did anyone actually see ${shortOf(target)} last night?` });
    if (confirmed) {
      g.marks.you.petty++;
      L.push({ who: confirmed[0], text: `I did. ${shortCap(target)} was with me all night.` });
    } else {
      g.marks[target].doubted += 1.5 * trust(g, YOU);
      L.push({ who: speakerFor(g, ['colonel', 'ada', 'cook', 'doctor'], target), text: `No. No, I don't suppose anyone did.` });
    }
  } else if (kind === 'swear') {
    L.push({ who: YOU, text: `I'll say it. I saw ${shortOf(target)} creeping by the ${ROOMS[nt.vroom].name} at midnight.` });
    if (confirmed) {
      g.marks.you.lies++;
      L.push({ who: confirmed[0], kind: 'refute', mark: YOU, text: `Impossible. ${shortCap(target)} was with me the whole night.` });
    } else {
      g.marks.you.swore++;
      g.marks[target].accused += SWEAR * trust(g, YOU);
      g.sworn.push({ n: g.n, target });
      L.push({ who: target, text: G[target].drunk ? `Me? I can barely find my own room.` : `That is a wicked lie.` });
      // to see that, you must have been out by the body yourself
      const v = g.confirmations[`${g.n}:${YOU}`];
      if (v) {
        delete g.confirmations[`${g.n}:${YOU}`]; recomputeCleared(g);
        g.recalls = g.recalls.filter(r => r.n !== g.n);
        g.marks.you.unverAdj++;
        L.push({ who: v[0], kind: 'conflict', mark: YOU, text: `Hold on. You were in the ${ROOMS[nt.claims.you].name} with me all night, Fenwick. When did you see that?` });
      } else if (!adjacent(nt.claims.you, nt.vroom)) {
        g.marks.you.unverAdj++; g.marks.you.unverFar = Math.max(0, g.marks.you.unverFar - 1);
        L.push({ who: speakerFor(g, ['doctor', 'colonel', 'cook', 'ada'], target), text: `And what were you doing by the ${ROOMS[nt.vroom].name} at midnight, Fenwick? You said you were in the ${ROOMS[nt.claims.you].name}.` });
      }
    }
  } else {
    L.push({ who: YOU, kind: 'quiet', text: '(You say nothing, and pass the salt.)' });
  }
  return L;
}

// ------------------------------------------------------------------ the table talks, then votes
export function candidates(g, voter) {
  const all = [YOU, ...g.alive];
  return all.filter(p => p !== voter && !isCleared(g, p) && !(G[voter]?.twin === p));
}
export function suspicionOf(g, voter, p) { return score(g, p) + g.bias[voter][p]; }
export function topSuspect(g, voter) {
  let best = null, bs = -1;
  for (const p of candidates(g, voter)) { const s = suspicionOf(g, voter, p); if (s > bs) { bs = s; best = p; } }
  return { id: best, s: bs };
}
// How a guest feels about you: 0 calm, 1 wary, 2 suspicious, 3 they'd vote for you now.
export function moodToward(g, voter) {
  if (isCleared(g, YOU)) return 0;
  const t = topSuspect(g, voter);
  const mine = suspicionOf(g, voter, YOU);
  if (t.id === YOU && t.s >= VOTE_FLOOR) return 3;
  if (mine >= t.s - 2 && mine >= 2) return 2;
  if (mine >= 1.5) return 1;
  return 0;
}

export function chatter(g) {
  const L = [];
  const said = new Set();
  const speakers = seatOrder(g).filter(id => id !== 'poet');
  const order = speakers.map(id => ({ id, t: topSuspect(g, id) })).filter(x => x.t.id && x.t.s >= VOTE_FLOOR).sort((a, b) => b.t.s - a.t.s);
  for (const { id, t } of order) {
    if (said.has(t.id) || L.length >= 2) continue;
    said.add(t.id);
    g.marks[t.id].remarks += trust(g, id);
    L.push({ who: id, kind: 'accuse', mark: t.id, text: accuseLine(id, t.id) });
  }
  if (!L.length) L.push({ who: speakerFor(g, ['colonel', 'doctor', 'cook']), text: `I won't see anyone locked up on a feeling. Not yet.` });
  g.phase = 'vote';
  return L;
}
function accuseLine(id, t) {
  const T = t === YOU ? 'Fenwick' : shortCap(t);
  return ({
    colonel: `I've my eye on ${T}. Never trust anyone who can't say where they were.`,
    reverend: `I fear for ${T}'s soul. And for ours, if we do nothing.`,
    ada: `${T} has been strange all week. Ida thinks so too.`,
    ida: `I've a feeling about ${T}. A very bad feeling.`,
    cook: `${T} has had a guilty look since breakfast.`,
    doctor: `Look at the facts. They keep coming back to ${T}.`,
    widow: `I would not sleep easy with ${T} under this roof.`,
  })[id] || `It's ${T}.`;
}

export function votes(g, yourVote) {
  const v = {};
  for (const id of g.alive) {
    const x = G[id];
    if (x.drunk) { const c = candidates(g, id); v[id] = c.length && rnd(g) < .7 ? pick(g, c) : null; continue; }
    const t = topSuspect(g, id);
    v[id] = t.s >= VOTE_FLOOR ? t.id : null;
  }
  if (v.reverend !== undefined && g.alive.includes('colonel') && v.colonel !== 'reverend') v.reverend = v.colonel;
  if (v.ida !== undefined && g.alive.includes('ada') && v.ada !== 'ida') v.ida = v.ada;
  if (yourVote) v.you = yourVote;
  return v;
}
export function tally(v, need = EXILE_VOTES) {
  const t = {};
  for (const k in v) if (v[k]) t[v[k]] = (t[v[k]] || 0) + 1;
  const ranked = Object.entries(t).sort((a, b) => b[1] - a[1]);
  let out = null;
  if (ranked.length && ranked[0][1] >= need && (ranked.length < 2 || ranked[1][1] < ranked[0][1])) out = ranked[0][0];
  return { t, out };
}
// Runs the vote and moves the game on. Returns { v, t, out }.
export function resolveVote(g, yourVote) {
  const v = votes(g, yourVote);
  const { t, out } = tally(v, exileVotes(g));
  if (out === YOU) {
    g.over = { win: false, why: 'exiled', n: g.n };
  } else if (out) {
    g.alive = g.alive.filter(id => id !== out);
    g.fate[out] = { kind: 'exiled', n: g.n };
  }
  if (!g.over) {
    if (g.n >= N_NIGHTS) g.over = { win: true, why: 'moon', n: g.n };
    else if (g.alive.length <= 1) g.over = { win: true, why: 'few', n: g.n };
  }
  g.phase = g.over ? 'over' : 'night';
  return { v, t, out };
}
// After the last night's dawn there is no more dinner: you've made it.
export function lastNightEnds(g) { return g.n >= N_NIGHTS; }
