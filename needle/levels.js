// The records. Each one is a song (patterns the towers fire on), a turntable layout (slots on the plinth,
// bridges over the vinyl, scratches and warps cut into it) and a running order of tracks (waves of dust).
//
// Patterns are 32 sixteenth-notes (two bars). 'x' is a hit. The towers fire on their part's hits; a tower at
// level 3 also fires on the part's busier "fill" pattern. Bass is a list of MIDI notes, 0 for a rest.

const P = s => s.replace(/\s+/g, '');
const N = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
// "A2 . . . E2 . ." → [45, 0, 0, 0, 40, 0, 0]
const bassLine = s => s.trim().split(/\s+/).map(t => {
  if (t === '.') return 0;
  const m = /^([A-G][#b]?)(\d)$/.exec(t);
  return m ? 12 * (+m[2] + 1) + N[m[1]] : 0;
});
const chord = s => s.split(' ').map(t => { const m = /^([A-G][#b]?)(\d)$/.exec(t); return 12 * (+m[2] + 1) + N[m[1]]; });

export const SONGS = {
  lesson: {
    title: 'Practice Single', bpm: 100, swing: 0, scale: [57, 60, 62, 64, 67, 69, 72, 74, 76],
    kick:   P('x... .... x... .... x... .... x... ....'),
    kickX:  P('x... .... x.x. .... x... ..x. x... ....'),
    snare:  P('.... x... .... x... .... x... .... x...'),
    snareX: P('.... x... .... x..x .... x... .... x.xx'),
    hat:    P('x.x. x.x. x.x. x.x. x.x. x.x. x.x. x.x.'),
    hatX:   P('xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx'),
    bass:   bassLine('A1 . . . . . A2 . . . A1 . . . . . F1 . . . . . F2 . . . G1 . G2 . . .'),
    bassX:  bassLine('A1 . A2 . . . A2 . E2 . A1 . . . G1 . F1 . F2 . . . F2 . C2 . G1 . G2 . D2 .'),
    chords: [chord('A3 C4 E4'), chord('F3 A3 C4')], stab: P('x... .... .... .... x... .... .... ....'), pad: true,
  },
  shuffle: {
    title: 'Late Night Shuffle', bpm: 86, swing: 0.2, scale: [62, 65, 67, 69, 72, 74, 77, 79],
    kick:   P('x... .... ..x. .... x... ...x ..x. ....'),
    kickX:  P('x..x .... ..x. .x.. x... ...x ..x. ..x.'),
    snare:  P('.... x... .... x... .... x... .... x...'),
    snareX: P('.... x..x .... x... .... x..x .x.. x...'),
    hat:    P('x.x. x.x. x.x. x.x. x.x. x.x. x.x. x.x.'),
    hatX:   P('x.xx x.xx x.xx x.xx x.xx x.xx x.xx x.xx'),
    bass:   bassLine('D2 . . . . . . . . . D2 . . . C2 . G1 . . . . . . . . . G1 . A1 . C2 .'),
    bassX:  bassLine('D2 . . D3 . . . . A1 . D2 . . . C2 . G1 . . G2 . . . . D2 . G1 . A1 . C2 .'),
    chords: [chord('F3 A3 C4 E4'), chord('F3 A3 B3 E4')], stab: P('..x. .... .... x... ..x. .... .... ....'), pad: false,
  },
  stomp: {
    title: 'Uptown Stomp', bpm: 116, swing: 0, scale: [60, 62, 64, 67, 69, 72, 74, 76],
    kick:   P('x... x... x... x... x... x... x... x...'),
    kickX:  P('x... x... x..x x... x... x... x.x. x.x.'),
    snare:  P('.... x... .... x... .... x... .... x...'),
    snareX: P('.... x... .... x.x. .... x... ..x. x.xx'),
    hat:    P('..x. ..x. ..x. ..x. ..x. ..x. ..x. ..x.'),
    hatX:   P('x.x. x.xx x.x. x.xx x.x. x.xx x.x. x.xx'),
    bass:   bassLine('C2 . . . C2 . E2 . G2 . . . A2 . G2 . F2 . . . F2 . A1 . C2 . . . G1 . B1 .'),
    bassX:  bassLine('C2 . C3 . C2 . E2 . G2 . G1 . A2 . G2 . F2 . F3 . F2 . A1 . C2 . C3 . G1 . B1 .'),
    chords: [chord('C4 E4 G4'), chord('F3 A3 C4')], stab: P('.... x... .... x... .... x... .... x...'), pad: false,
  },
  rag: {
    title: 'Shellac Rag', bpm: 132, swing: 0.28, scale: [58, 60, 62, 65, 67, 70, 72, 74],
    kick:   P('x... .... x... .... x... .... x... ....'),
    kickX:  P('x... ..x. x... .... x... ..x. x... x...'),
    snare:  P('.... x... .... x... .... x... .... x...'),
    snareX: P('.... x... .... x.x. .... x... ..x. x.x.'),
    hat:    P('x... x.x. x... x.x. x... x.x. x... x.x.'),
    hatX:   P('x.x. x.xx x.x. x.xx x.x. x.xx x.x. x.xx'),
    bass:   bassLine('Bb1 . . . D2 . . . F2 . . . D2 . . . Eb2 . . . G2 . . . F2 . . . C2 . . .'),
    bassX:  bassLine('Bb1 . . . D2 . . . F2 . G2 . A2 . . . Eb2 . . . G2 . Bb2 . F2 . . . C2 . E2 .'),
    chords: [chord('D4 F4 Bb4'), chord('Eb4 G4 Bb4')], stab: P('..x. ..x. ..x. ..x. ..x. ..x. ..x. ..x.'), pad: false,
  },
};

// Where things are, in turntable units: the record is 100 across from the spindle to the rim, the
// plinth slots sit on a ring just outside it, bridges are fixed bars across the vinyl.
export const R_REC = 100, R_OUT = 92, R_IN = 40, R_LABEL = 34, R_RING = 120;

const ring = (...degs) => degs.map(d => ({ x: Math.cos(d * Math.PI / 180) * R_RING, y: Math.sin(d * Math.PI / 180) * R_RING }));
// a bar from (x1,y1) to (x2,y2) with slots at the given fractions along it
const bridge = (x1, y1, x2, y2, ...fs) => ({ x1, y1, x2, y2, slots: fs.map(f => ({ x: x1 + (x2 - x1) * f, y: y1 + (y2 - y1) * f })) });

// Tracks: each is a list of groups [kind, count, gap seconds, start delay]
export const RECORDS = [
  {
    id: 'lesson', song: 'lesson', rpm: 45, rev: 6.0, turns: 2.6, sleeve: 'lesson', hpMul: 0.45, size: '7"',
    ring: ring(200, 245, 285, 160, 110, 70, 40),
    bridges: [bridge(-62, 52, 62, 52, 0.2, 0.8)],
    scratches: [], warps: [], startNickels: 120,
    tracks: [
      [['lint', 5, 1.6, 0]],
      [['lint', 6, 1.2, 0], ['hair', 4, 1.4, 4]],
      [['lint', 6, 1.0, 0], ['crumb', 3, 3, 3], ['hair', 4, 0.8, 9]],
    ],
  },
  {
    id: 'shuffle', song: 'shuffle', rpm: 33, rev: 7.2, turns: 2.6, sleeve: 'shuffle', hpMul: 1.5, size: '12"',
    ring: ring(195, 235, 275, 155, 115, 75, 35),
    bridges: [bridge(-96, 0, -28, 0, 0.3, 0.75)],
    scratches: [], warps: [], startNickels: 160,
    tracks: [
      [['lint', 8, 1.3, 0]],
      [['lint', 10, 1.0, 0], ['hair', 5, 1.2, 6]],
      [['crumb', 4, 2.5, 0], ['lint', 10, 0.8, 4]],
      [['hair', 12, 0.6, 0], ['lint', 8, 1, 6]],
      [['crumb', 8, 1.6, 0], ['hair', 10, 0.7, 5], ['lint', 12, 0.6, 10]],
      [['lint', 14, 0.5, 0], ['crumb', 6, 1.4, 4], ['smudge', 1, 1, 12], ['hair', 10, 0.5, 14]],
    ],
  },
  {
    id: 'stomp', song: 'stomp', rpm: 45, rev: 5.3, turns: 2.9, sleeve: 'stomp', hpMul: 1.75, size: '7"',
    ring: ring(215, 250, 290, 145, 110, 70, 35),
    bridges: [bridge(-30, -96, -30, -30, 0.25, 0.8), bridge(30, 30, 96, 30, 0.25, 0.75)],
    scratches: [{ a: 0.6, r1: 50, r2: 92 }, { a: 3.6, r1: 44, r2: 80 }], warps: [], startNickels: 180,
    tracks: [
      [['lint', 10, 1.0, 0]],
      [['hair', 10, 0.7, 0], ['lint', 8, 1, 5]],
      [['crumb', 6, 1.8, 0], ['spark', 6, 1.2, 4]],
      [['lint', 16, 0.5, 0], ['hair', 10, 0.5, 6]],
      [['spark', 10, 0.8, 0], ['crumb', 8, 1.2, 4]],
      [['hair', 18, 0.35, 0], ['crumb', 6, 1.2, 6], ['spark', 8, 0.8, 9]],
      [['lint', 16, 0.4, 0], ['smudge', 2, 6, 6], ['spark', 12, 0.6, 9], ['crumb', 8, 1, 14]],
    ],
  },
  {
    id: 'rag', song: 'rag', rpm: 78, rev: 3.6, turns: 3.1, sleeve: 'rag', hpMul: 2.3, size: '10"',
    ring: ring(190, 225, 260, 295, 155, 120, 85, 50),
    bridges: [bridge(-88, -46, 88, -46, 0.17, 0.5, 0.83)],
    scratches: [{ a: 2.2, r1: 46, r2: 92 }], warps: [{ a1: 4.2, a2: 5.2 }], startNickels: 230,
    tracks: [
      [['lint', 12, 0.8, 0]],
      [['hair', 14, 0.5, 0], ['spark', 4, 1, 5]],
      [['crumb', 8, 1.4, 0], ['lint', 12, 0.5, 4]],
      [['spark', 10, 0.7, 0], ['hair', 12, 0.5, 5]],
      [['crumb', 10, 1, 0], ['smudge', 1, 1, 6], ['lint', 16, 0.4, 8]],
      [['hair', 24, 0.3, 0], ['spark', 12, 0.5, 5], ['crumb', 8, 0.9, 9]],
      [['smudge', 3, 4, 0], ['lint', 20, 0.35, 3], ['spark', 14, 0.5, 8]],
      [['crumb', 14, 0.7, 0], ['hair', 24, 0.3, 4], ['smudge', 4, 3, 8], ['spark', 16, 0.4, 12]],
    ],
  },
];

export const DUST = {
  //        hp   speed  leak  pay   size
  lint:   { hp: 27,   v: 20, leak: 1, pay: 3,  r: 5.5, name: 'Lint' },
  hair:   { hp: 15,   v: 36, leak: 1, pay: 3,  r: 4.5, name: 'Hair' },
  crumb:  { hp: 90,  v: 13, leak: 2, pay: 8,  r: 7.5, name: 'Crumb' },
  spark:  { hp: 36,  v: 22, leak: 1, pay: 5,  r: 5,   name: 'Static', skips: true },
  smudge: { hp: 650, v: 8,  leak: 6, pay: 40, r: 13,  name: 'Thumbprint' },
};

// The four parts. dmg/range per level 1..3; cost to buy, then to upgrade to 2 and 3.
export const PARTS = {
  kick:  { name: 'Kick',  blurb: 'Thumps on the kick drum. Splash.', cost: [60, 55, 90],  dmg: [7, 11, 16], range: [64, 70, 76], splash: [16, 18, 21], color: '#d8452b' },
  snare: { name: 'Snare', blurb: 'Cracks on 2 and 4. Long reach.',    cost: [80, 70, 110], dmg: [16, 26, 40], range: [100, 112, 124], color: '#f1d27a' },
  hat:   { name: 'Hat',   blurb: 'Ticks every eighth. Quick, light.', cost: [40, 40, 70],  dmg: [2, 3, 4.5], range: [54, 58, 62], color: '#5fb8ad' },
  bass:  { name: 'Bass',  blurb: 'Wobbles on the bass. Slows dust.',   cost: [70, 60, 90],  dmg: [2, 3.5, 5], range: [56, 62, 68], slow: [0.5, 0.42, 0.34], color: '#9a6fd0' },
};
export const PART_KEYS = ['kick', 'snare', 'hat', 'bass'];

export const FIDELITY = 20;
