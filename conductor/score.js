// The programme. Each piece is a list of passages: a melody, its chords (one per bar, "F/G7" splits a bar),
// and who does what. compile() turns that into a flat list of notes on a beat clock.
export const SECTIONS = [
  { id: 'str',   name: 'Strings',  who: 'Miss Pettifer and the strings', key: '1', pan: -.42 },
  { id: 'wood',  name: 'Woodwind', who: 'the Misses Ames',              key: '2', pan: -.12 },
  { id: 'brass', name: 'Brass',    who: 'Mr Bulstrode and nephew',      key: '3', pan: .28 },
  { id: 'tuba',  name: 'Tuba',     who: 'old Mr Gantry',                key: '4', pan: .08 },
  { id: 'drum',  name: 'Drums',    who: 'young Tobias',                 key: '5', pan: .46 },
  { id: 'tri',   name: 'Triangle', who: 'Mr Pym',                       key: '6', pan: .62 },
  { id: 'solo',  name: 'Soloist',  who: 'Madame Zubova',                key: '7', pan: 0 },
];
export const DYN = { pp: .16, p: .32, mp: .46, mf: .6, f: .78, ff: .95 };

const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const midi = (s) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(s); if (!m) throw new Error('bad note ' + s); return PC[m[1]] + (+m[2] + 1) * 12; };
export function chordNotes(c) {
  const m = /^([A-G][#b]?)(m?)(7?)$/.exec(c); if (!m) throw new Error('bad chord ' + c);
  const r = PC[m[1]], third = m[2] ? 3 : 4;
  return { root: r, tones: m[3] ? [0, third, 7, 10].map(i => r + i) : [0, third, 7].map(i => r + i) };
}
// nearest pitch of pitch class `pc` at or above `lo`
const above = (pc, lo) => { let n = lo + ((pc - lo) % 12 + 12) % 12; return n; };

const YD_A = 'C5 C5 D5 E5 | C5 E5 D5 G4 | C5 C5 D5 E5 | C5:1 B4:1 | C5 C5 D5 E5 | F5 E5 D5 C5 | B4 G4 A4 B4 | C5:1 C5:1';
const YD_B = 'A4:.75 B4:.25 A4 G4 | A4 B4 C5:1 | G4:.75 A4:.25 G4 F4 | E4:1 G4:1 | A4:.75 B4:.25 A4 G4 | A4 B4 C5 A4 | G4 C5 B4 D5 | C5:1 C5:1';
const YD_CA = 'C G7 C G7 C F G7 C', YD_CB = 'F C G7 C F F G7/C C';

const DAN = 'C4 C4 E4 | G4:2 G4 | R G5 G5 | R E5 E5 | C4 C4 E4 | G4:2 G4 | R A5 A5 | R F5 F5 | B3 B3 D4 | A4:2 A4 | R A5 A5 | R F5 F5 | B3 B3 D4 | A4:2 A4 | R G5 G5 | R E5 E5 | C4 C4 E4 | G4 C5 E5 | G5:3 | G5 E5 C5 | A5:2 A5 | F5 D5 B4 | C5:2 E5 | D5:2 A4 | G4:2 E5 | D5:2 B4 | C5:3 | C5 R R';
const DAN_C = 'C C C C C C G7 G7 G7 G7 G7 G7 G7 G7 C C C C C C F Dm C D7 G7 G7 C C';

const BR = 'G4:2 E4:.5 E4:.5 | G4:2 E4:.5 G4:.5 | C5 B4 A4:.5 A4:.5 | G4:2 D4:.5 E4:.5 | F4:2 D4:.5 E4:.5 | F4:2 D4:.5 F4:.5 | B4 A4 G4:.5 B4:.5 | C5:2 C4:.5 C4:.5 | C5:2 A4:.5 F4:.5 | G4:2 E4:.5 C4:.5 | F4 G4 A4 | G4:2 C4:.5 C4:.5 | C5:2 A4:.5 F4:.5 | G4:2 E4:.5 C4:.5 | F4 E4 D4 | C4:3';
const BR_C = 'C C G7 C G7 G7 G7 C F C F C F C G7 C';

const HAB_V = 'D5:.75 C#5:.25 C5 C5 | B4 Bb4 A4:1 | Bb4:.75 A4:.25 G4 G4 | F4 E4 D4:1 | D5:.75 C#5:.25 C5 C5 | B4 Bb4 A4:1 | Bb4:.75 A4:.25 G4 F4 | E4 F4 A4:1';
const HAB_VC = 'Dm Dm A7 Dm Dm Dm A7 A7';
const HAB_R = 'F#5:.75 E5:.25 D5:1 | A4:.75 B4:.25 A4:1 | G4 A4 B4 C#5 | E5:1 R:1 | F#5:.75 E5:.25 D5:1 | B4:.75 C#5:.25 D5 E5 | F#5 E5 D5 C#5 | D5:2';
const HAB_RC = 'D D A7 A7 D G A7 D';

const MK_A = 'B3 C#4 D4 E4 F#4 D4 F#4:1 | F4 C#4 F4:1 E4 C4 E4:1 | B3 C#4 D4 E4 F#4 D4 F#4 B4 | A4 F#4 D4 F#4 A4:2';
const MK_B = 'F#4 G#4 A#4 B4 C#5 A#4 C#5:1 | D5 A#4 D5:1 C#5 A#4 C#5:1 | F#4 G#4 A#4 B4 C#5 A#4 C#5 F#5 | E5 C#5 A#4 C#5 E5:2';
const MK_CA = 'Bm F#7 Bm F#7', MK_CB = 'F# F# F# F#';

const OD_1 = 'E5:1 E5:1 F5:1 G5:1 | G5:1 F5:1 E5:1 D5:1 | C5:1 C5:1 D5:1 E5:1 | E5:1.5 D5:.5 D5:2 | E5:1 E5:1 F5:1 G5:1 | G5:1 F5:1 E5:1 D5:1 | C5:1 C5:1 D5:1 E5:1 | D5:1.5 C5:.5 C5:2';
const OD_2 = 'D5:1 D5:1 E5:1 C5:1 | D5:1 E5:.5 F5:.5 E5:1 C5:1 | D5:1 E5:.5 F5:.5 E5:1 D5:1 | C5:1 D5:1 G4:2 | E5:1 E5:1 F5:1 G5:1 | G5:1 F5:1 E5:1 D5:1 | C5:1 C5:1 D5:1 E5:1 | D5:1.5 C5:.5 C5:2';
const OD_C1 = 'C G C/G C/G C G C G/C', OD_C2 = 'G C G C G C F/C G7/C';

const CC_A = 'C5:1.5 D5:.5 | F5 E5 D5 G5 | G5:1 G5 A5 | E5 F5 D5:1 | D5 F5 E5 D5 | C5 C6 B5 A5 | G5 F5 E5 D5 | C5:1 C5:1';
const CC_C = 'C G7 G7 G7 G7 C G7 C';

export const PROGRAMME = [
  {
    id: 'yankee', num: 'I', title: 'A Quick-Step', sub: 'being “Yankee Doodle”, by request of the American Consul, who has not attended',
    meter: 2, bpm: 108, scene: 'prom', style: 'in two',
    pass: [
      { mel: YD_A, ch: YD_CA, u: .5, dyn: 'mf', parts: { str: 'mel', tuba: 'bass' } },
      { mel: YD_B, ch: YD_CB, u: .5, dyn: 'p', parts: { wood: 'mel', str: 'off', tuba: 'bass' } },
      { mel: YD_A, ch: YD_CA, u: .5, dyn: 'f', parts: { str: 'mel', wood: 'mel+8', brass: 'off', tuba: 'bass', drum: 'march' } },
      { mel: YD_B, ch: YD_CB, u: .5, dyn: 'f', parts: { brass: 'mel', str: 'pad', wood: 'mel+8', tuba: 'bass', drum: 'march' } },
      { mel: 'C5 G4 C5 G4 | C5:1 R:1', ch: 'C C', u: .5, dyn: 'ff', parts: { str: 'mel', wood: 'mel+8', brass: 'mel', tuba: 'bass', drum: 'hit' }, bpm: 96 },
    ],
    cues: [{ bar: 9, sec: 'wood', bars: 8 }, { bar: 17, sec: 'brass', bars: 8 }, { bar: 17, sec: 'drum', bars: 16 }, { bar: 34, sec: 'tri', bars: 1, ting: true }],
    troubles: [{ bar: 26, sec: 'drum', kind: 'rush', bars: 7 }],
    ritFrom: 32,
  },
  {
    id: 'danube', num: 'II', title: 'A Valse', sub: 'after Herr Strauss, at some distance, and in the wrong shoes',
    meter: 3, bpm: 132, scene: 'river', style: 'in three',
    pass: [
      { mel: DAN, ch: DAN_C, u: 1, dyn: 'mp', parts: { brass: 'mel', str: 'waltz', tuba: 'bass' }, split: { at: 76, sec: 'wood' } },
      { mel: DAN, ch: DAN_C, u: 1, dyn: 'f', parts: { str: 'mel', wood: 'mel+8', brass: 'waltz', tuba: 'bass', drum: 'waltz' } },
      { mel: 'C5 E5 G5 | C6 G5 E5 | C6:3 | C6 R R', ch: 'C C C C', u: 1, dyn: 'ff', parts: { str: 'mel', wood: 'mel', brass: 'mel', tuba: 'bass', drum: 'hit' }, bpm: 112 },
    ],
    cues: [{ bar: 3, sec: 'wood', bars: 14 }, { bar: 29, sec: 'str', bars: 8, note: 'all together' }, { bar: 29, sec: 'drum', bars: 28 }, { bar: 60, sec: 'tri', bars: 1, ting: true }],
    troubles: [{ bar: 19, sec: 'str', kind: 'drag', bars: 9 }, { bar: 42, sec: 'drum', kind: 'rush', bars: 8 }],
    tempo: { 23: 118, 25: 104, 29: 132, 51: 118, 53: 104 },
    ritFrom: 57,
  },
  {
    id: 'lullaby', num: 'III', title: 'A Cradle Song', sub: 'by Dr Brahms. Patrons are requested to remain awake',
    meter: 3, bpm: 80, scene: 'night', style: 'in three, and small',
    pass: [
      { mel: 'R:2 E4:.5 E4:.5', ch: 'C', u: 1, dyn: 'p', parts: { str: 'mel', tuba: 'long' } },
      { mel: BR, ch: BR_C, u: 1, dyn: 'p', parts: { str: 'mel', wood: 'pad', tuba: 'long' } },
      { mel: 'R:2 E5:.5 E5:.5', ch: 'C', u: 1, dyn: 'pp', parts: { wood: 'mel', tuba: 'long' } },
      { mel: BR, ch: BR_C, u: 1, dyn: 'pp', shift: 12, parts: { wood: 'mel', str: 'arp', tuba: 'long' } },
      { mel: 'R R R', ch: 'C', u: 1, dyn: 'pp', parts: { str: 'pad', tuba: 'long' } },
    ],
    cues: [{ bar: 18, sec: 'wood', bars: 17 }, { bar: 35, sec: 'tri', bars: 1, ting: true }],
    troubles: [{ bar: 9, sec: 'tuba', kind: 'sleep', bars: 25 }, { bar: 24, sec: 'str', kind: 'drag', bars: 7 }],
    ritFrom: 32,
  },
  {
    id: 'habanera', num: 'IV', title: 'A Habanera', sub: 'after M. Bizet, sung by Madame Zubova, who has her own ideas about it',
    meter: 2, bpm: 76, scene: 'seville', style: 'in two, with a soloist',
    pass: [
      { mel: 'R:2 | R:2 | R:2 | R:2', ch: 'Dm Dm Dm Dm', u: 1, dyn: 'p', parts: { str: 'hab', drum: 'tam' } },
      { mel: HAB_V, ch: HAB_VC, u: .5, dyn: 'mf', parts: { solo: 'mel', str: 'hab', tuba: 'hab', drum: 'tam' } },
      { mel: HAB_R, ch: HAB_RC, u: .5, dyn: 'f', parts: { solo: 'mel', wood: 'mel', str: 'hab', tuba: 'hab', brass: 'off', drum: 'tam' } },
      { mel: HAB_V, ch: HAB_VC, u: .5, dyn: 'mp', parts: { solo: 'mel', wood: 'mel-8', str: 'hab', tuba: 'hab', drum: 'tam' } },
      { mel: 'A4:2 | R:2', ch: 'A7 A7', u: .5, dyn: 'f', parts: { solo: 'mel', str: 'pad', wood: 'pad', brass: 'pad', tuba: 'long' } },
      { mel: 'F#5:.75 E5:.25 D5:1 | A5:1 F#5:1 | D6:1 R:1', ch: 'D A7 D', u: .5, dyn: 'ff', parts: { solo: 'mel', str: 'mel', wood: 'mel', brass: 'off', tuba: 'bass', drum: 'hit' } },
    ],
    cues: [{ bar: 5, sec: 'solo', bars: 8 }, { bar: 13, sec: 'wood', bars: 8 }, { bar: 13, sec: 'brass', bars: 8 }, { bar: 31, sec: 'tri', bars: 1, ting: true }],
    troubles: [{ bar: 16, sec: 'solo', kind: 'rogue', bars: 5 }, { bar: 23, sec: 'solo', kind: 'rogue', bars: 6 }],
    ferm: [{ bar: 30, beat: 1, sec: 3.4, sec_id: 'solo', run: ['A4','C#5','E5','G5','A5','G5','F#5','E5','D5','C#5','B4','A4','G4','A4','E5','A5'] }],
  },
  {
    id: 'mountain', num: 'V', title: 'In the Hall of a Mountain King', sub: 'by Herr Grieg. It gets quicker. Nothing can be done about that',
    meter: 4, bpm: 76, scene: 'cavern', style: 'in four',
    pass: [
      { mel: MK_A, ch: MK_CA, u: .5, dyn: 'pp', shift: -12, parts: { tuba: 'mel', str: 'pizz' } },
      { mel: MK_A, ch: MK_CA, u: .5, dyn: 'p', parts: { wood: 'mel', str: 'pizz', tuba: 'bass' } },
      { mel: MK_B, ch: MK_CB, u: .5, dyn: 'p', parts: { wood: 'mel', str: 'pizz', tuba: 'bass' } },
      { mel: MK_A, ch: MK_CA, u: .5, dyn: 'mf', parts: { str: 'mel', wood: 'mel+8', tuba: 'bass' }, bpm: 92, bpmTo: 104 },
      { mel: MK_B, ch: MK_CB, u: .5, dyn: 'mf', parts: { str: 'mel', wood: 'mel+8', tuba: 'bass' }, bpm: 104, bpmTo: 112 },
      { mel: MK_A, ch: MK_CA, u: .5, dyn: 'f', shift: 12, parts: { str: 'mel', brass: 'mel-12', wood: 'mel', tuba: 'bass', drum: 'four' }, bpm: 112, bpmTo: 122 },
      { mel: MK_B, ch: MK_CB, u: .5, dyn: 'f', shift: 12, parts: { str: 'mel', brass: 'mel-12', wood: 'mel', tuba: 'bass', drum: 'four' }, bpm: 122, bpmTo: 134 },
      { mel: MK_A, ch: MK_CA, u: .5, dyn: 'ff', shift: 12, parts: { str: 'mel', brass: 'mel-12', wood: 'mel+8', tuba: 'bass', drum: 'four' }, bpm: 134, bpmTo: 146 },
      { mel: 'B4:1 R:1 F#4:1 R:1 | B4:1 R:1 F#4:1 R:1 | B4:1 B4:1 B4:1 B4:1 | B4:1 R:3', ch: 'Bm Bm Bm Bm', u: 1, dyn: 'ff', parts: { str: 'mel', wood: 'mel', brass: 'mel', tuba: 'mel-24', drum: 'hit' }, bpm: 146 },
    ],
    cues: [{ bar: 5, sec: 'wood', bars: 8 }, { bar: 13, sec: 'str', bars: 8, note: 'bows, please' }, { bar: 21, sec: 'brass', bars: 8 }, { bar: 21, sec: 'drum', bars: 16 }, { bar: 36, sec: 'tri', bars: 1, ting: true }],
    troubles: [{ bar: 8, sec: 'tuba', kind: 'sleep', bars: 8 }, { bar: 17, sec: 'str', kind: 'drag', bars: 4 }, { bar: 27, sec: 'drum', kind: 'rush', bars: 8 }],
  },
  {
    id: 'ode', num: 'VI', title: 'Grand Finale', sub: 'an Ode to Joy, Herr Beethoven’s, with the entire Society and Madame Zubova',
    meter: 4, bpm: 96, scene: 'dawn', style: 'in four, and everyone',
    pass: [
      { mel: OD_1, ch: OD_C1, u: 1, dyn: 'p', shift: -12, parts: { str: 'mel', tuba: 'long' } },
      { mel: OD_2, ch: OD_C2, u: 1, dyn: 'mf', parts: { wood: 'mel', str: 'arp4', tuba: 'bass' } },
      { mel: OD_1, ch: OD_C1, u: 1, dyn: 'f', parts: { solo: 'mel', str: 'mel', wood: 'mel+8', brass: 'off', tuba: 'bass', drum: 'four' } },
      { mel: OD_2, ch: OD_C2, u: 1, dyn: 'ff', parts: { solo: 'mel', str: 'mel', wood: 'mel+8', brass: 'mel-12', tuba: 'bass', drum: 'four' } },
      { mel: 'G5:1 G5:1 G5:1 G5:1 | C6:4 | C6:1 R:3', ch: 'G7 C C', u: 1, dyn: 'ff', parts: { solo: 'mel', str: 'mel', wood: 'mel', brass: 'mel-12', tuba: 'bass', drum: 'hit' }, bpm: 84 },
    ],
    cues: [{ bar: 9, sec: 'wood', bars: 8 }, { bar: 17, sec: 'solo', bars: 8 }, { bar: 17, sec: 'brass', bars: 8 }, { bar: 17, sec: 'drum', bars: 16 }, { bar: 35, sec: 'tri', bars: 1, ting: true }],
    troubles: [{ bar: 13, sec: 'str', kind: 'drag', bars: 4 }, { bar: 21, sec: 'solo', kind: 'rogue', bars: 4 }, { bar: 25, sec: 'tuba', kind: 'sleep', bars: 8 }, { bar: 28, sec: 'drum', kind: 'rush', bars: 6 }],
    ferm: [{ bar: 34, beat: 1, sec: 2.2 }],
  },
];
export const ENCORE = {
  id: 'cancan', num: 'Encore', title: 'A Galop', sub: 'by M. Offenbach. The Committee has asked that nobody kick',
  meter: 2, bpm: 132, scene: 'cabaret', style: 'in two, flat out',
  pass: [
    { mel: CC_A, ch: CC_C, u: .5, dyn: 'f', parts: { str: 'mel', brass: 'off', tuba: 'bass', drum: 'march' } },
    { mel: CC_A, ch: CC_C, u: .5, dyn: 'f', parts: { wood: 'mel', str: 'mel', brass: 'off', tuba: 'bass', drum: 'march' }, bpm: 138 },
    { mel: CC_A, ch: CC_C, u: .5, dyn: 'ff', parts: { wood: 'mel+8', str: 'mel', brass: 'mel-12', tuba: 'bass', drum: 'march' }, bpm: 146 },
    { mel: 'C6 G5 C6 G5 | C6:1 R:1', ch: 'C C', u: .5, dyn: 'ff', parts: { str: 'mel', wood: 'mel', brass: 'mel', tuba: 'bass', drum: 'hit' }, bpm: 146 },
  ],
  cues: [{ bar: 9, sec: 'wood', bars: 8 }, { bar: 26, sec: 'tri', bars: 1, ting: true }],
  troubles: [{ bar: 5, sec: 'drum', kind: 'rush', bars: 6 }, { bar: 13, sec: 'str', kind: 'drag', bars: 4 }, { bar: 19, sec: 'tuba', kind: 'sleep', bars: 4 }],
};

// A two-beat ditty for the rehearsal that can go round for ever.
export const REHEARSAL = {
  id: 'rehearsal', num: '', title: 'Rehearsal', sub: '', meter: 2, bpm: 96, scene: 'bare', style: 'in two', loop: true,
  pass: [{ mel: YD_A, ch: YD_CA, u: .5, dyn: 'mf', parts: { str: 'mel', tuba: 'bass', brass: 'off', wood: 'mel+8', drum: 'march' } }],
  cues: [], troubles: [],
};

function parseBars(mel, u, meter) {
  return mel.split('|').map((bar, i) => {
    const notes = []; let t = 0;
    for (const tok of bar.trim().split(/\s+/)) {
      const [n, d] = tok.split(':'); const dur = d ? parseFloat(d) : u;
      if (n !== 'R') notes.push({ t, m: midi(n), d: dur }); t += dur;
    }
    if (Math.abs(t - meter) > 1e-6) throw new Error(`bar ${i + 1} of "${mel.slice(0, 20)}…" has ${t} beats`);
    return notes;
  });
}

function role(kind, ctx) {
  const { b0, meter, ch, push, bar, dyn } = ctx; const chord = (i) => ch[Math.min(i, ch.length - 1)];
  const beatsPer = meter / ch.length;
  const at = (beat) => chordNotes(chord(Math.floor(beat / beatsPer)));
  const voiced = (beat, lo, n = 3) => { const c = at(beat); return c.tones.slice(0, n).map(pc => above(pc, lo)); };
  const bassNote = (beat, alt) => { const c = at(beat); const pc = alt ? c.root + 7 : c.root; return above(pc % 12, 36); };
  switch (kind) {
    case 'bass': // root on the strong beat, fifth on the second strong beat
      if (meter === 2) { push(b0, bassNote(0, bar % 2), 1, 1, 'bass'); }
      else if (meter === 3) push(b0, bassNote(0, bar % 2), 1.2, 1, 'bass');
      else { push(b0, bassNote(0, 0), 1.4, 1, 'bass'); push(b0 + 2, bassNote(2, 1), 1.4, .9, 'bass'); }
      break;
    case 'long': push(b0, bassNote(0, 0), meter, .7, 'long'); break;
    case 'off': // after-beats
      if (meter === 2) { for (const b of [.5, 1.5]) for (const m of voiced(b, 60)) push(b0 + b, m, .35, .7, 'stab'); }
      else for (let b = 1; b < meter; b += meter === 4 ? 2 : 1) for (const m of voiced(b, 60)) push(b0 + b, m, .4, .7, 'stab');
      break;
    case 'waltz': for (const b of [1, 2]) for (const m of voiced(b, 62)) push(b0 + b, m, .5, b === 1 ? .8 : .65, 'stab'); break;
    case 'pad': for (const m of voiced(0, 55)) push(b0, m, meter, .6, 'pad'); break;
    case 'pizz': for (let b = 0; b < meter; b++) push(b0 + b, above(at(b).root, 47) + (b % 2 ? 7 : 0), .4, .9, 'pizz'); break;
    case 'arp': { const c = voiced(0, 55); const seq = [0, 1, 2, 1, 2, 1]; seq.forEach((n, i) => push(b0 + i * .5, c[n], .5, i ? .55 : .75, 'pizz')); break; }
    case 'arp4': for (let i = 0; i < meter * 2; i++) { const c = voiced(i / 2, 55); push(b0 + i * .5, c[i % 3], .5, i % 2 ? .5 : .7, 'pizz'); } break;
    case 'hab': { // the habanera limp
      const r = bassNote(0, 0) + 12, c = voiced(0, 57);
      push(b0, r, .7, 1, 'pizz'); push(b0 + .75, r + 7, .25, .7, 'pizz'); push(b0 + 1, r, .5, .9, 'pizz'); push(b0 + 1.5, r + 7, .5, .8, 'pizz');
      if (dyn !== 'p') for (const m of c) push(b0 + 1, m, .4, .35, 'stab');
      break;
    }
    case 'march': if (meter === 2) { push(b0, 0, .2, 1, 'bd'); push(b0 + 1, 0, .2, .8, 'sn'); push(b0 + 1.5, 0, .2, .55, 'sn'); push(b0 + 1.75, 0, .2, .45, 'sn'); } break;
    case 'waltz_d': break;
    case 'four': push(b0, 0, .2, 1, 'bd'); push(b0 + 1, 0, .2, .6, 'sn'); push(b0 + 2, 0, .2, .8, 'bd'); push(b0 + 3, 0, .2, .65, 'sn'); push(b0 + 3.5, 0, .2, .4, 'sn'); break;
    case 'tam': push(b0, 0, .2, .55, 'sn'); push(b0 + .75, 0, .2, .4, 'sn'); push(b0 + 1, 0, .2, .55, 'sn'); push(b0 + 1.5, 0, .2, .45, 'sn'); break;
    case 'hit': push(b0, 0, .5, 1, 'bd'); push(b0, 0, .5, .9, 'cy'); break;
  }
}

// bars are numbered from 1, as a player would count them
export function compile(piece) {
  const meter = piece.meter; const ev = []; const marks = []; let bar = 1;
  for (const pa of piece.pass) {
    const bars = parseBars(pa.mel, pa.u, meter), shift = pa.shift || 0, chs = pa.ch.split(/\s+/).map(c => c.split('/'));
    if (bars.length !== chs.length) throw new Error(`${piece.id}: ${bars.length} bars, ${chs.length} chords at bar ${bar}`);
    const dynV = DYN[pa.dyn];
    bars.forEach((notes, i) => {
      const b0 = (bar - 1) * meter;
      for (let k = 0; k < meter; k++) {
        const f = bars.length > 1 ? i / (bars.length - 1) : 0;
        const base = pa.bpm ?? piece.bpm;
        marks[b0 + k] = { dyn: dynV, dynName: pa.dyn, bpm: pa.bpmTo ? base + (pa.bpmTo - base) * f : base };
      }
      const pushFor = (sec, kind, extra = 0, isMel) => (b, m, d, v, k = kind) => ev.push({ b, sec, m: m + extra, d, v, k, mel: !!isMel });
      for (const [sec, r] of Object.entries(pa.parts)) {
        const mm = /^mel([+-]\d+)?$/.exec(r);
        if (mm) {
          const off = mm[1] ? (+mm[1] === 8 || +mm[1] === -8 ? Math.sign(+mm[1]) * 12 : +mm[1]) : 0;
          for (const n of notes) {
            const target = pa.split && n.m + shift >= pa.split.at ? pa.split.sec : sec;
            ev.push({ b: b0 + n.t, sec: target, m: n.m + shift + off, d: n.d, v: off === 0 ? 1 : .7, k: 'mel', mel: off === 0 });
          }
        } else if (r === 'waltz' && sec === 'drum') { const p = pushFor(sec, 'bd'); p(b0, 0, .2, .6); }
        else role(r, { b0, meter, ch: chs[i], push: pushFor(sec, r), bar: i, dyn: pa.dyn });
      }
      bar++;
    });
  }
  const lastBar = bar - 1, total = lastBar * meter;
  // tempo bumps and a final easing off
  if (piece.tempo) { let cur = null; for (let b = 0; b < total; b++) { const nb = Math.floor(b / meter) + 1; if (b % meter === 0 && piece.tempo[nb]) cur = piece.tempo[nb]; if (nb > Math.min(...Object.keys(piece.tempo).map(Number)) - 1 && cur) marks[b].bpm = cur; } }
  if (piece.ritFrom) { const s = (piece.ritFrom - 1) * meter; for (let b = s; b < total; b++) marks[b].bpm *= 1 - .16 * (b - s) / Math.max(1, total - s); }
  const cues = (piece.cues || []).map(c => ({ ...c, beat: (c.bar - 1) * meter + (c.at || 0), end: (c.bar - 1 + c.bars) * meter, done: false, late: false, missed: false }));
  for (const c of cues) if (c.ting) ev.push({ b: c.beat, sec: 'tri', m: 96, d: 2, v: 1, k: 'ting', mel: false });
  const troubles = (piece.troubles || []).map(t => ({ ...t, beat: (t.bar - 1) * meter, end: (t.bar - 1 + t.bars) * meter, on: false, fixed: false, over: false }));
  const ferm = (piece.ferm || []).map(f => ({ ...f, beat: (f.bar - 1) * meter + (f.beat - 1) }));
  ev.sort((a, b) => a.b - b.b);
  return { piece, meter, events: ev, marks, total, lastBar, cues, troubles, ferm };
}
