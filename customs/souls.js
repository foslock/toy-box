// Customs of the Dead: making souls and their papers, comparing fields, and the right answer for each soul.
// Pure logic, no DOM, so it runs in Node too.
import { FIRST, LAST, CAUSES, TOWNS, VIRTUES, VICES, PETNAMES, GREET, RULES, DAYS } from './data.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const pick = (r, a) => a[Math.floor(r() * a.length)];
export const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// Day numbers count from 1 November; 0 is 31 October.
export function fmtDate(n) {
  if (n <= 0) return (31 + n) + ' OCT';
  if (n > 30) return (n - 30) + ' DEC';
  return n + ' NOV';
}

export const SEALS = ['moth', 'key', 'hand', 'eye', 'bell', 'moon', 'star', 'skull'];
export const sealOf = (day, seed) => day < 7 ? 'moth' : SEALS[Math.floor(rng(seed * 31 + day * 977)() * SEALS.length)];

export const rulesFor = day => new Set(RULES.filter(r => r.day <= day).map(r => r.id));

// Faces: hat 0-6, forehead motif 0-4, eye-ring colour 0-4, shirt 0-5, moustache, glasses, red marigold.
export const HATS = 7, MOTIFS = 5;
export function randomFace(r) {
  return { hat: int(r, 0, HATS - 1), motif: int(r, 0, MOTIFS - 1), ring: int(r, 0, 4), shirt: int(r, 0, 5),
    mous: r() < .3, glasses: r() < .2, flower: false };
}
export const faceKey = f => [f.hat, f.motif, f.ring, f.shirt, +f.mous, +f.glasses, +f.flower].join();
function alterFace(r, f) {
  const g = { ...f }, k = int(r, 0, 3);
  if (k === 0) { do g.hat = int(r, 0, HATS - 1); while (g.hat === f.hat); }
  else if (k === 1) { do g.motif = int(r, 0, MOTIFS - 1); while (g.motif === f.motif); }
  else if (k === 2) g.mous = !f.mous;
  else g.glasses = !f.glasses;
  return g;
}

const SWAP = { b: 'v', v: 'b', s: 'z', z: 's', i: 'y', y: 'i', g: 'j', j: 'g', o: 'u', u: 'o', e: 'i', a: 'e', c: 's', n: 'm', m: 'n', r: 'l', l: 'r' };
export function typo(r, name) {
  for (let tries = 0; tries < 30; tries++) {
    const words = name.split(' '), w = int(r, 0, words.length - 1), s = words[w];
    if (s.length < 4) continue;
    const i = int(r, 1, s.length - 2), op = int(r, 0, 2);
    let t = s;
    if (op === 0 && SWAP[s[i]]) t = s.slice(0, i) + SWAP[s[i]] + s.slice(i + 1);
    else if (op === 1 && s[i] !== s[i + 1]) t = s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
    else if (op === 2) t = s[i] === s[i - 1] ? s.slice(0, i) + s.slice(i + 1) : s.slice(0, i) + s[i] + s.slice(i);
    if (t !== s && t[0] === t[0].toUpperCase()) { words[w] = t; return words.join(' '); }
  }
  return name.replace(/a/, 'o');
}

// A soul and its papers. `o` overrides anything (story souls).
export function makeSoul(day, r, o = {}) {
  const rules = rulesFor(day);
  const name = o.name || pick(r, FIRST) + ' ' + pick(r, LAST);
  const died = o.died ?? day - int(r, 0, 2);
  let virtues, vices;
  if (o.virtues != null) { virtues = o.virtues; vices = o.vices; }
  else {
    const tie = rules.has('mercy') && r() < .18;
    const base = int(r, 2, 9), diff = tie ? 0 : int(r, 1, 4);
    if (r() < .55) { virtues = base + diff; vices = base; } else { virtues = base; vices = base + diff; }
  }
  const s = {
    name, died, virtues, vices,
    cause: o.cause || pick(r, CAUSES), town: pick(r, TOWNS), born: int(r, 1846, 1912),
    face: o.face || randomFace(r), pet: o.pet !== undefined ? o.pet : (rules.has('cats') && r() < .3 ? (r() < .65 ? 'cat' : 'dog') : null),
    petName: pick(r, PETNAMES), cord: false, seal: sealOf(day, o.seed || 0),
    virtueEx: pick(r, VIRTUES), viceEx: pick(r, VICES),
    greet: o.greet || pick(r, GREET), story: o.story || null, bribe: o.bribe || 0,
    issues: [], bad: {}, docs: {}, order: [],
  };
  s.appt = o.appt ?? died - int(r, 0, 4);
  if (o.flower) s.face = { ...s.face, flower: true };

  // Truthful papers first.
  const d = s.docs;
  d.card = { name, died, cause: s.cause, town: s.town, born: s.born, photo: s.face };
  d.cert = { name, died, cause: s.cause, seal: s.seal };
  d.deeds = { name, virtues, vices, virtueEx: s.virtueEx, viceEx: s.viceEx };
  if (rules.has('summons')) d.summons = { name, appt: s.appt };
  if (s.pet === 'cat') d.catform = { owner: name, cat: s.petName };

  // Then the fault, if any.
  let faults = [];
  if (o.issue !== undefined) faults = o.issue ? [].concat(o.issue) : [];
  else {
    const cfg = DAYS[Math.min(day, 10)], rate = day >= 6 ? .5 : day === 1 ? .4 : .45;
    if (r() < rate) {
      const pool = cfg.faults.filter(f => applicable(f, s));
      const weighted = pool.flatMap(f => (cfg.fresh || []).includes(f) ? [f, f, f] : [f]);
      if (weighted.length) faults.push(pick(r, weighted));
      for (const f of faults) applyFault(r, s, f);
      // a second fault only touches papers the first one left on the desk
      if (day >= 8 && r() < .15) {
        const more = cfg.faults.filter(f => !faults.includes(f) && f !== 'missing' && applicable(f, s));
        if (more.length) applyFault(r, s, pick(r, more));
      }
    }
    faults = [];
  }
  for (const f of faults) applyFault(r, s, f);
  if (o.cord) applyFault(r, s, 'cord');
  s.order = ['card', 'cert', 'deeds', 'summons', 'catform'].filter(k => d[k]);
  return s;
}

function applicable(f, s) {
  const d = s.docs;
  if (f === 'nocatform') return !!d.catform && !s.missing;
  if (f === 'catowner') return !!d.catform;
  if (f === 'early') return !!d.summons;
  if (f === 'died' || f === 'cause' || f === 'seal') return !!d.cert;
  return true;
}

function applyFault(r, s, f) {
  const d = s.docs;
  s.issues.push(f);
  if (f === 'name') {
    const k = pick(r, ['cert', 'deeds', 'summons'].filter(k => d[k]));
    d[k].name = typo(r, s.name); s.bad[k + '.name'] = 'name';
  } else if (f === 'died') {
    const k = r() < .7 ? 'cert' : 'card';
    d[k].died = s.died + (r() < .5 ? -1 : 1) * int(r, 1, 3); s.bad[k + '.died'] = 'died';
  } else if (f === 'cause') {
    let c; do c = pick(r, CAUSES); while (c === s.cause);
    d.cert.cause = c; s.bad['cert.cause'] = 'cause';
  } else if (f === 'photo') {
    d.card.photo = alterFace(r, s.face); s.bad['card.photo'] = 'photo';
  } else if (f === 'missing') {
    const k = pick(r, ['cert', 'deeds', 'summons'].filter(k => d[k]));
    s.missing = k; delete d[k];
  } else if (f === 'early') {
    d.summons.appt = s.appt = s.died + int(r, 2, 18); s.bad['summons.appt'] = 'early';
  } else if (f === 'nocatform') {
    delete d.catform; s.missing = 'catform';
  } else if (f === 'catowner') {
    d.catform.owner = r() < .5 ? typo(r, s.name) : pick(r, FIRST) + ' ' + s.name.split(' ')[1];
    if (d.catform.owner === s.name) d.catform.owner = typo(r, s.name);
    s.bad['catform.owner'] = 'catowner';
  } else if (f === 'cord') {
    s.cord = true;
  } else if (f === 'seal') {
    let x; do x = pick(r, SEALS); while (x === s.seal);
    d.cert.seal = x; s.bad['cert.seal'] = 'seal';
  }
}

export function expected(s, day) {
  if (s.issues.length) return 'return';
  if (s.virtues > s.vices) return 'orchard';
  if (s.virtues === s.vices && rulesFor(day).has('mercy')) return 'orchard';
  return 'stair';
}

// Why a decision was wrong, in a citation's words.
export function citationText(s, day, chose) {
  const want = expected(s, day);
  if (want === 'return') {
    const f = s.issues[0];
    return 'Passed a soul with ' + ({
      name: 'mismatched names', died: 'mismatched dates of death', cause: 'mismatched causes of death',
      photo: 'a photo that did not match', missing: 'a missing ' + DOCNAME[s.missing], early: 'a summons dated after death',
      nocatform: 'a cat and no cat form', catowner: 'the wrong owner on the cat form', cord: 'a silver cord (still alive)',
      seal: 'the wrong registrar seal',
    }[f] || 'faulty papers') + '.';
  }
  if (chose === 'return') return 'Returned a soul whose papers were in order.';
  if (want === 'orchard') return s.virtues === s.vices ? 'Sent a tied soul to the Stair (Mercy Amendment).' : 'Sent a soul with more virtues than vices to the Stair.';
  return s.virtues === s.vices ? 'Sent a tied soul to the Orchard before the Mercy Amendment.' : 'Sent a soul with more vices than virtues to the Orchard.';
}

export const DOCNAME = { card: 'SOUL CARD', cert: 'DEATH CERTIFICATE', deeds: 'RECORD OF DEEDS', summons: 'SUMMONS', catform: 'CAT FORM', note: 'NOTE' };

// Comparable fields: each has a kind, and two fields of the same kind must agree.
const KIND = { name: 'name', owner: 'name', died: 'died', appt: 'appt', cause: 'cause', photo: 'photo', face: 'photo', seal: 'seal' };
export const kindOf = ref => KIND[ref.split('.')[1]];
function valueOf(s, ref, seal) {
  const [doc, key] = ref.split('.');
  if (doc === 'window') return key === 'face' ? s.face : null;
  if (doc === 'rules') return seal;
  return s.docs[doc]?.[key];
}
const SAME = { name: 'NAMES MATCH', died: 'DATES MATCH', cause: 'CAUSES MATCH', photo: 'FACE MATCHES', seal: 'SEALS MATCH' };
const DIFF = { name: 'NAMES DIFFER', died: 'DATES DIFFER', cause: 'CAUSES DIFFER', photo: 'NOT THE SAME FACE', seal: 'WRONG SEAL' };

// -> { ok, text, issue? }  ok: true (agree), false (discrepancy), null (nothing to compare)
export function compare(s, a, b, seal) {
  const ka = kindOf(a), kb = kindOf(b);
  const va = valueOf(s, a, seal), vb = valueOf(s, b, seal);
  if (ka && ka === kb && ka !== 'appt') {
    const same = ka === 'photo' ? faceKey(va) === faceKey(vb) : va === vb;
    if (same) return { ok: true, text: SAME[ka] };
    return { ok: false, text: DIFF[ka], issue: s.bad[a] || s.bad[b] || ka };
  }
  if ((ka === 'died' && kb === 'appt') || (ka === 'appt' && kb === 'died')) {
    const died = ka === 'died' ? va : vb, appt = ka === 'appt' ? va : vb;
    if (appt > died) return { ok: false, text: 'DIED BEFORE SUMMONS', issue: 'early' };
    return { ok: true, text: 'SUMMONS IN ORDER' };
  }
  return { ok: null, text: 'NOTHING TO COMPARE' };
}

// The queue for a day: random souls with the story's souls slotted in.
export function buildDay(day, st) {
  const r = rng(st.seed * 7919 + day * 104729);
  const cfg = DAYS[day], seal = sealOf(day, st.seed);
  const mk = (o = {}) => makeSoul(day, r, { seed: st.seed, ...o });
  const q = [];
  const story = [];
  if (st.flags.cucaArrives === day) story.push([0, mk({ name: 'Refugio Robles', story: 'cuca', issue: null, virtues: 9, vices: 4, pet: null,
    face: { hat: 5, motif: 0, ring: 1, shirt: 4, mous: false, glasses: true, flower: false }, cause: 'a cold winter',
    greet: 'Mi vida? They told me you would be here.' })]);
  if (day === 1) {
    story.push([0, mk({ name: 'Amparo Vega', issue: null, virtues: 7, vices: 3, story: 'tut1', greet: 'Good evening. Is this the Gate?' })]);
    story.push([1, mk({ name: 'Benito Galindo', issue: null, virtues: 4, vices: 6, story: 'tut2', greet: 'I have my papers right here.' })]);
    const b = story[1][1]; b.docs.cert.name = 'Benito Galinda'; b.issues = ['name']; b.bad['cert.name'] = 'name';
    story.push([2, mk({ name: 'Carmela Ibarra', issue: null, virtues: 3, vices: 8, story: 'tut3', greet: 'Let us get this over with.' })]);
  }
  if (day === 3) story.push([2, mk({ name: 'Ignacio Ferro', story: 'ignacio1', issue: 'early', virtues: 11, vices: 3,
    face: IGNACIO, cause: 'a fever', greet: 'Ignacio Ferro, accordion. I think I came too soon.' })]);
  if (day === 4) story.push([3, mk({ name: 'Fausto Lira', story: 'bribe', issue: 'cause', virtues: 3, vices: 6, bribe: 5,
    greet: 'A small gift for a busy clerk. No need to look too hard.' })]);
  if (day === 5) story.push([1, mk({ name: 'Concha Clavel', story: 'clavel', issue: null, pet: 'cat', virtues: 6, vices: 4,
    greet: 'This is Bigotes. He goes where I go.' })]);
  if (day === 6) story.push([3, mk({ name: 'Ignacio Ferro', story: 'ignacio2', issue: null, cord: true, virtues: 11, vices: 3, pet: null,
    face: IGNACIO, cause: 'a fever', greet: 'You again! The fever came back, and here I am.' })]);
  if (day === 7) {
    story.push([0, mk({ story: 'gallo', issue: null })]);
    story.push([3, mk({ story: 'cousin', issue: null, flower: true, virtues: 2, vices: 7, pet: null, greet: 'My cousin says you are a friend.' })]);
    story.push([6, mk({ story: 'cousin', issue: null, flower: true, virtues: 3, vices: 9, pet: null, greet: 'Nice flower, no? Very red.' })]);
  }
  if (day === 8) {
    story.push([1, mk({ story: 'cousin', issue: null, flower: true, virtues: 1, vices: 8, pet: null, greet: 'El Gallo sends his regards.' })]);
    story.push([5, mk({ story: 'cousin', issue: null, flower: true, virtues: 4, vices: 10, pet: null, greet: 'Do not count too carefully.' })]);
  }
  if (day === 9) {
    story.push([2, mk({ name: 'Mercedes Ossa', story: 'mercedes', issue: null, virtues: 3, vices: 9, pet: 'cat',
      greet: 'My husband said you would be expecting me.' })]);
    story.push([5, mk({ name: 'Ignacio Ferro', story: 'ignacio3', issue: null, virtues: 12, vices: 3, pet: null,
      face: IGNACIO, cause: 'old age', greet: 'Third time. This time it is real. I made my goodbyes.' })]);
  }
  if (day === 10 && st.flags.truth) story.push([cfg.count - 1, mk({ name: 'Aurelio Ossa', story: 'ossa', issue: null, virtues: 2, vices: 11, pet: null,
    face: { hat: 3, motif: 3, ring: 3, shirt: 0, mous: true, glasses: true, flower: false }, greet: 'You. Of all the clerks.' })]);

  const n = cfg.count + (st.flags.cucaArrives === day ? 1 : 0);
  for (let i = 0; i < n; i++) q.push(null);
  for (const [at, s] of story) {
    let i = Math.min(at, n - 1);
    while (q[i]) i = (i + 1) % n;
    q[i] = s;
  }
  for (let i = 0; i < n; i++) if (!q[i]) q[i] = mk();
  for (const s of q) s.seal ||= seal;
  return q;
}

const IGNACIO = { hat: 1, motif: 0, ring: 0, shirt: 2, mous: true, glasses: false, flower: false };
