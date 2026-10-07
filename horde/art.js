// Horde: every sprite, drawn as rows of letters, one letter a colour. Each one gets a 1px ink outline and is baked
// three ways: lit (in the hero's lantern), moonlit (out in the dark, where only the eyes keep their colour), and a
// white flash for when it's hit. Also the tiny pixel font for damage numbers, and the hero's item icons.

export const INK = '#0d0812';
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// moonlight: everything falls onto one cold ramp by brightness, keeping a trace of its own colour
const MOON = ['#05050b', '#0a0b17', '#111324', '#191c31', '#22273f', '#2e3550', '#3d4664', '#525d7c', '#6b7795'].map(hex);
export function moonOf(rgb, keep = 0.13, lift = 0) {
  const L = (0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]) / 255;
  const f = Math.min(MOON.length - 1.001, Math.pow(L, 0.85) * (MOON.length - 1) * 0.86 + lift);
  const i = Math.floor(f), base = mix(MOON[i], MOON[i + 1], f - i);
  return mix(base, rgb, keep);
}
export { hex, toHex, mix };

/* ---------------------------------------------------------------------------------------------- the horde */
// glow letters (eyes) keep their colour in the dark
const MOB_ART = {
  imp: {
    pal: { h: '#d8c49a', H: '#9a845c', d: '#3f1230', m: '#74203f', l: '#a4405c', p: '#c9677a', E: '#ffd23f', w: '#e8dcc0' },
    glow: 'E',
    frames: [[
      'h.....h',
      'Hh...hH',
      '.dmmmd.',
      'dmElEmd',
      '.dwmwd.',
      'p.mmm.p',
      'dmmlmmd',
      '.dm.md.',
      '.d...d.',
    ], [
      '.......',
      'h.....h',
      'Hh...hH',
      '.dmmmd.',
      'dmElEmd',
      'pdwmwdp',
      '.dmlmd.',
      '.dm.md.',
      'd.....d',
    ]],
  },
  bat: {
    pal: { d: '#2a1236', m: '#4c2058', l: '#74357c', E: '#ff5f8f', f: '#c99ab8' },
    glow: 'E',
    frames: [[
      'd.......d',
      'md.....dm',
      'lmd.f.dml',
      '.lmdmdml.',
      '..mEmEm..',
      '...mdm...',
    ], [
      '.........',
      '....f....',
      '..dmdmd..',
      '.dmEmEmd.',
      'dmlmdmlmd',
      'm.l...l.m',
    ]],
  },
  brute: {
    pal: { d: '#28331f', m: '#465a35', l: '#6b8148', L: '#93a865', b: '#5b3a20', B: '#7d5530', E: '#ff3b2f', t: '#d8c8a0', s: '#1c2416' },
    glow: 'E',
    frames: [[
      '....dddd.....',
      '...dmmmmd....',
      '..ddEmEmdd...',
      '.dmmdtdtmmdd.',
      'dmlLmmmmmlLmd',
      'dlLLlmmmlLLld',
      'dmlllmmmlllmd',
      'dmmldmmmdlmmd',
      'dmmdmmmmmdmmd',
      '.ddbBbBbBbdd.',
      'dsd.bmmmb.dsd',
      '.d..mmdmm..d.',
      '...dmd.dmd...',
      '...ddd..dd...',
    ], [
      '.....dddd....',
      '....dmmmmd...',
      '...ddEmEmdd..',
      '.ddmmdtdtmmd.',
      'dmlLmmmmmlLmd',
      'dlLLlmmmlLLld',
      'dmlllmmmlllmd',
      'dmmldmmmdlmmd',
      'dmmdmmmmmdmmd',
      '.ddbBbBbBbdd.',
      'dsd.bmmmb.dsd',
      '.d..mmdmm..d.',
      '...dmd.dmd...',
      '...dd..ddd...',
    ]],
  },
  bloat: {
    pal: { d: '#3c4a26', m: '#6e8a3c', l: '#9fbb5a', L: '#cfe08a', s: '#2a1a26', E: '#f0ff70', p: '#8c3a4a', v: '#b85a6a' },
    glow: 'E',
    frames: [[
      '....ddd....',
      '...dEmEd...',
      '..ddmpmdd..',
      '.dmllllLmd.',
      'dmlLLlslLmd',
      'dmlLlslllmd',
      'dmllslLllmd',
      'dmmlllvllmd',
      '.dmmmmmmmd.',
      '..ddm.mdd..',
      '..dd...dd..',
    ], [
      '...........',
      '....ddd....',
      '...dEmEd...',
      '.dddmpmddd.',
      'dmlllllLlmd',
      'dlLLLlslLld',
      'dlLLlslllld',
      'dmllslLlllmd'.slice(0, 11),
      'dmmlllvllmd',
      '.ddmmmmmdd.',
      '..dd...dd..',
    ]],
  },
  shield: {
    pal: { w: '#e2d6b8', W: '#a8987a', i: '#2c2c3a', I: '#4e4f66', J: '#74778f', r: '#9a1e2c', R: '#d23a3a', E: '#9fe8ff', h: '#5e6178' },
    glow: 'E',
    frames: [[
      '..hhh....',
      '.hIIIh...',
      '.hEwEh...',
      '..wWw.iii',
      '.wWwWiIJJi',
      'w.WwiIrRJi',
      '..wwiRRRJi',
      '..WwiIrRJi',
      '..w.iIrIJi',
      '..w.iIIIJi',
      '.w.wiJJJJi',
      '.W..WiiiI.',
      'WW..WW....',
    ], [
      '..hhh....',
      '.hIIIh...',
      '.hEwEh...',
      '..wWw.iii',
      '.wWwWiIJJi',
      'w.WwiIrRJi',
      '..wwiRRRJi',
      '..WwiIrRJi',
      '..w.iIrIJi',
      '..w.iIIIJi',
      '.w.wiJJJJi',
      '..W.WiiiI.',
      '..WW.WW...',
    ]],
  },
  hag: {
    pal: { c: '#3a2440', C: '#5a3a62', D: '#7a5280', s: '#9caa7a', S: '#c0cc94', E: '#e6a2ff', g: '#c8c2b0', b: '#4a3220', B: '#6a4a2a', o: '#9fffb0' },
    glow: 'Eo',
    frames: [[
      '..ggg...o.',
      '.gCCCg..B.',
      'gCsEsSg.B.',
      '.CSsSs..B.',
      '.cCsscCsB.',
      'cCDCCcCsB.',
      'cCDCCCc.B.',
      '.cCDCCc.B.',
      '.cCCDCCcB.',
      'cCCCDCCcb.',
      'cCcCCcCCcb',
      '.cc.c.cc..',
    ], [
      '..ggg..o..',
      '.gCCCg.B..',
      'gCsEsSgB..',
      '.CSsSs.B..',
      '.cCsscCB..',
      'cCDCCcCsB.',
      'cCDCCCc.B.',
      '.cCDCCc.B.',
      '.cCCDCCcB.',
      'cCCCDCCcb.',
      'cCcCCcCCc.',
      '..cc.cc...',
    ]],
  },
};

/* ---------------------------------------------------------------------------------------------- the heroes */
// k skin, K skin shade, and each one's own cloth. walk frames 0, 1 and a hurt/idle 2
const SKIN = { k: '#f0c49a', K: '#c58a66', e: '#2a1a1a' };
const HERO_ART = {
  squire: {
    pal: { ...SKIN, s: '#c9ccd8', S: '#8a8ea4', t: '#efe6d0', T: '#b9ab8a', r: '#b02a2a', b: '#5a3a22', B: '#3c2616', w: '#8a5a30', l: '#2c2434', h: '#e7c46a' },
    frames: [[
      '...SSSS.....',
      '..SsssSS....',
      '.SSSSSSSS...',
      '...kkek.....',
      '...KkkK.....',
      '..tTtrtT....',
      '.ktTrrrTk...',
      '.k.TtrtT.w..',
      '..bbbbbb..w.',
      '...TtTt....w',
      '...TtTt.....',
      '...l..l.....',
      '...B..BB....',
    ], [
      '...SSSS.....',
      '..SsssSS....',
      '.SSSSSSSS...',
      '...kkek.....',
      '...KkkK.....',
      '..tTtrtT.w..',
      '.ktTrrrTkw..',
      '...TtrtT.w..',
      '..bbbbbb..w.',
      '...TtTt.....',
      '..TtTt......',
      '..l...l.....',
      '..BB..B.....',
    ]],
  },
  nun: {
    pal: { ...SKIN, n: '#1c1824', N: '#34303f', M: '#4c4658', w: '#f2ece0', W: '#bdb4a4', r: '#a3202e', R: '#d4a03a', g: '#e2c25a' },
    frames: [[
      '...nnnn.....',
      '..nwwwwn....',
      '.nnwkekn....',
      '.nnwKkKn....',
      '.nNwwwwNn...',
      '.nNNgNNNn...',
      '.nNrRrNNkn..',
      '.nNrRrNNNn..',
      '.nNNNNNMNn..',
      '.nNNNNNMNn..',
      'nNNNNNNNMNn.',
      'nnnnnnnnnnn.',
    ], [
      '...nnnn.....',
      '..nwwwwn....',
      '.nnwkekn....',
      '.nnwKkKn....',
      '.nNwwwwNn...',
      '.nNNgNNNn...',
      '.nNrRrNNkn..',
      '.nNrRrNNNn..',
      '.nNNNNNMNn..',
      '.nNNNNNNMn..',
      '.nNNNNNNMNn.',
      '.nnnnnnnnnn.',
    ]],
  },
  huntress: {
    pal: { ...SKIN, g: '#2f5a34', G: '#4f8a46', H: '#78b05a', b: '#6a4428', B: '#3e2816', s: '#d8dde8', y: '#e0b860', r: '#8a3a1a' },
    frames: [[
      '...gggg.....',
      '..gGGGGg....',
      '.gGkekGg....',
      '.gGKkkg.....',
      '.ggGGGgg....',
      'gGbGHbGgs...',
      'gGkbybGk....',
      'g.GbbbG.....',
      '.g.bBb......',
      '...b.b......',
      '...b..b.....',
      '...B..B.....',
    ], [
      '...gggg.....',
      '..gGGGGg....',
      '.gGkekGg....',
      '.gGKkkg.....',
      '.ggGGGgg....',
      'gGbGHbGg.s..',
      'g.kbybGk....',
      'gg.bbbG.....',
      '..gbBb......',
      '...b.b......',
      '..b...b.....',
      '..B...B.....',
    ]],
  },
  magister: {
    pal: { ...SKIN, h: '#6a1622', H: '#9a2632', r: '#7a1a26', R: '#b23a3e', o: '#e2a040', w: '#e8e6ea', W: '#b0aeb8', b: '#3a2416', f: '#ffb43a' },
    frames: [[
      '....h.......',
      '....hH......',
      '...hHHh.....',
      '..hhHHhh....',
      '.hHHHHHHh...',
      '...kekk.....',
      '...wwWw.....',
      '..rwwwwR.f..',
      '.rRrwwRrkb..',
      '.rRRwRRR.b..',
      '.rRRoRRR.b..',
      'rRRRRRRRr...',
      'rrrrrrrrr...',
    ], [
      '....h.......',
      '....hH......',
      '...hHHh.....',
      '..hhHHhh....',
      '.hHHHHHHh...',
      '...kekk.....',
      '...wwWw..f..',
      '..rwwwwRkb..',
      '.rRrwwRr.b..',
      '.rRRwRRR.b..',
      '.rRRoRRR.b..',
      '.rRRRRRRr...',
      '.rrrrrrrr...',
    ]],
  },
  friar: {
    pal: { ...SKIN, b: '#5a3a24', B: '#7a5434', C: '#9a7048', r: '#d8c890', h: '#6a4a30', g: '#f0ecd8' },
    frames: [[
      '...hkkh.....',
      '..hkkkkh....',
      '..kkekkk....',
      '..KkkkkK....',
      '..bBkkBb....',
      '.bBBBBBBb...',
      'bBBCCCCBBb..',
      'kBCCCCCCBk..',
      'bBrrrrrrBbg.',
      'bBBCCCCBBb..',
      '.bBBBBBBb...',
      '..bB..Bb....',
      '..bb..bb....',
    ], [
      '...hkkh.....',
      '..hkkkkh....',
      '..kkekkk....',
      '..KkkkkK....',
      '..bBkkBb....',
      '.bBBBBBBb...',
      'bBBCCCCBBbg.',
      'kBCCCCCCBk..',
      'bBrrrrrrBb..',
      'bBBCCCCBBb..',
      '.bBBBBBBb...',
      '.bB....Bb...',
      '.bb....bb...',
    ]],
  },
  saint: {
    pal: { ...SKIN, o: '#ffe27a', O: '#f2b640', s: '#eef0f6', S: '#b8bccc', D: '#8a8ea6', c: '#3a5ab0', C: '#5a82d8', y: '#e8c45a', h: '#c8a060' },
    frames: [[
      '..oOOOo.....',
      '.o.....o....',
      '...hhhh.....',
      '..hkekkh....',
      '...kkkk.....',
      '.CsSyySsC...',
      'cCsyyyyskC..',
      'cCSsyySSkC..',
      'cCDSSSSDCo..',
      'cc.SDDS.co..',
      '...sS.Ss....',
      '...D..D.....',
      '...SS.SS....',
    ], [
      '..oOOOo.....',
      '.o.....o....',
      '...hhhh.....',
      '..hkekkh....',
      '...kkkk.....',
      '.CsSyySsCo..',
      'cCsyyyyskCo.',
      'cCSsyySSkC..',
      'cCDSSSSDC...',
      'cc.SDDS.c...',
      '..sS..Ss....',
      '..D....D....',
      '..SS...SS...',
    ]],
  },
};

/* ---------------------------------------------------------------------------------------------- the field's furniture */
const PROP_ART = {
  grave: { pal: { a: '#8c8a96', b: '#6a6874', c: '#4a4854', d: '#b4b2bc', m: '#4a5a32' }, rows: [
    '.dddd.',
    'daaaab',
    'dacaab',
    'daccab',
    'dacaab',
    'daaaab',
    'dabbab',
    'mbbbbm',
  ] },
  grave2: { pal: { a: '#7c7a86', b: '#5c5a66', c: '#3c3a46', d: '#a4a2ac', m: '#4a5a32' }, rows: [
    '..dd..',
    '.daab.',
    'ddaabb',
    'daaaab',
    '.dcab.',
    '.daab.',
    '.dabb.',
    'mbbbbm',
  ] },
  cross: { pal: { a: '#9a98a2', b: '#6a6874', d: '#c4c2ca', m: '#4a5a32' }, rows: [
    '..d...',
    '..ab..',
    'ddaab.',
    'baaabb',
    '..ab..',
    '..ab..',
    '..ab..',
    '..ab..',
    '.mbbm.',
  ] },
  candle: { pal: { w: '#efe6d0', W: '#b9ab8a', f: '#ffd65a', F: '#fff6c0', s: '#6a6874' }, glow: 'fF', rows: [
    '.F.',
    '.f.',
    '.w.',
    'wWw',
    'sss',
  ] },
  stone: { pal: { a: '#6e6c78', b: '#4e4c58', d: '#9a98a4' }, rows: [
    '.dd..',
    'daab.',
    'aabbb',
  ] },
  tuft: { pal: { g: '#5a7038', G: '#7a9048' }, rows: [
    'g.G.g',
    '.gGg.',
  ] },
  shrine: { pal: { a: '#8a8894', b: '#5e5c68', c: '#3e3c48', d: '#b0aeb8', r: '#7a5230', f: '#ffd65a', F: '#fff6c0' }, glow: 'fF', rows: [
    '...dd...',
    '..dabb..',
    '.daaabb.',
    'ddddbbbb',
    '.acccca.',
    '.ac.Fca.',
    '.ac.fca.',
    '.acccca.',
    '.aaaaab.',
    '..abab..',
    '..abab..',
    '..abab..',
    '.dbbbbb.',
  ] },
  sign: { pal: { w: '#8a5a30', W: '#5a3a1e', t: '#c49a60' }, rows: [
    '..W....',
    'ttttttW',
    'twwwwtW',
    '..W....',
    '..W....',
    'tttttW.',
    'wwwwwW.',
    '..W....',
    '..W....',
    '..W....',
  ] },
  stump: { pal: { b: '#5a3a22', B: '#7a5230', r: '#a07040', c: '#3a2416' }, rows: [
    '.rrrr.',
    'rBbbBr',
    'bBBBBb',
    'bcbbcb',
    'cbccbc',
  ] },
  birch: { pal: { w: '#e8e2d6', W: '#b4ac9e', k: '#2a2622', g: '#4a6a30', G: '#6a8a40', H: '#8aa652' }, rows: [
    '..gGGg..',
    '.gGHHGg.',
    'gGHGgHGg',
    'gGGgGGgg',
    '.gGgwGg.',
    '..g.wW..',
    '....kW..',
    '....wW..',
    '....wk..',
    '....wW..',
    '....kW..',
    '....wW..',
    '...wwWW.',
  ] },
  fern: { pal: { g: '#3e5a2a', G: '#5e7e38', H: '#86a44c' }, rows: [
    'G.....G',
    '.G.H.G.',
    'g.GHG.g',
    '.gGHGg.',
    '..gGg..',
  ] },
  shroom: { pal: { r: '#b8443a', R: '#e06a50', w: '#f0e6d0' }, glow: '', rows: [
    '.rRr.',
    'rRwRr',
    '..w..',
  ] },
  beam: { pal: { c: '#1e1612', C: '#3a2a20', e: '#ff7a2a', E: '#ffc24a' }, glow: 'eE', rows: [
    '.ccCCcc....',
    'cCCcCCCcce.',
    'cCcCCcCCcE.',
    '.cccccccc..',
  ] },
  millstone: { pal: { a: '#7a7882', b: '#5a5864', c: '#3a3844', d: '#a4a2ac' }, rows: [
    '..dddd..',
    '.daaaab.',
    'daabbaab',
    'dabccbab',
    'dabccbab',
    'baabbaab',
    '.bbaabb.',
    '..bbbb..',
  ] },
  ember: { pal: { e: '#ff6a1a', E: '#ffc04a', c: '#2a1e18' }, glow: 'eE', rows: [
    '.E.',
    'eEe',
    'cec',
  ] },
  herb: { pal: { g: '#3a5a2a', G: '#5c843a', w: '#e8e2c8', s: '#4a3a2a' }, rows: [
    '.w.G.w.',
    'GgwGwgG',
    'gGgGgGg',
    'sssssss',
  ] },
  well: { pal: { a: '#8a8894', b: '#5e5c68', c: '#3e3c48', d: '#b0aeb8', w: '#2a3a5a', W: '#3a5a8a', r: '#7a5230', R: '#a07040' }, rows: [
    '.r......r.',
    '.RrrrrrrR.',
    '.r......r.',
    '.r......r.',
    'ddddddddd.',
    'dabaabab.b',
    'aWwwwwwWab',
    'abaabaabab',
    '.bbcbbcbb.',
  ] },
  hedge: { pal: { g: '#2a4a24', G: '#3e6430', H: '#5a8040', d: '#1e3418' }, rows: [
    '.GHGGHGGHG.',
    'GHgGHgGHgGG',
    'gGgGgGgGgGg',
    'dgdgdgdgdgd',
  ] },
  standing: { pal: { a: '#8a8894', b: '#62606c', c: '#42404c', d: '#acaab4', m: '#5a6a3a' }, rows: [
    '..dd..',
    '.daab.',
    '.daab.',
    'daacab',
    'daacbb',
    'daaabb',
    'dacabb',
    'daaabb',
    'daabbb',
    'mbbbbm',
  ] },
  heather: { pal: { p: '#8a4a5a', P: '#b06a72', g: '#4a5a32' }, rows: [
    '.P.p.',
    'pPpPp',
    'gpgpg',
  ] },
  bones: { pal: { w: '#d8ccb0', W: '#a0947a' }, rows: [
    'w...w',
    '.wWw.',
    'w...w',
  ] },
};

/* ---------------------------------------------------------------------------------------------- the hero's kit, drawn small */
const KIT_ART = {
  book: { pal: { r: '#8a1a26', R: '#c8343e', w: '#f6f0e2', W: '#c9bfa8', g: '#ffd65a' }, rows: [
    '.ww.ww.',
    'wWwgwWw',
    'wwWgWww',
    'RrrgrrR',
  ] },
  axe: { pal: { s: '#dfe6f0', S: '#9aa4b8', w: '#8a5a30', W: '#5a3a1e' }, rows: [
    '.sSs...',
    'sSSSs..',
    'sSSwSs.',
    '.s.wWs.',
    '....w..',
    '.....w.',
    '......W',
  ] },
  flask: { pal: { g: '#dff6ff', b: '#6ac8ff', B: '#3a7ad8', c: '#a07040' }, rows: [
    '.c.',
    '.g.',
    'gbg',
    'bBb',
  ] },
  gem1: { pal: { a: '#e8fbff', b: '#7ad8ff', c: '#3a8ad8', d: '#24548c' }, glow: 'abcd', rows: [
    '.a.',
    'abc',
    'bcd',
    '.d.',
  ] },
  gem2: { pal: { a: '#f2ffe0', b: '#9cf06a', c: '#4ab04a', d: '#2a6a3a' }, glow: 'abcd', rows: [
    '..a..',
    '.abc.',
    'abbcd',
    '.bcd.',
    '..d..',
  ] },
  gem3: { pal: { a: '#fff0f0', b: '#ff8a8a', c: '#d83a4a', d: '#7a1a2a' }, glow: 'abcd', rows: [
    '..a..',
    '.aab.',
    'abbcc',
    'bbccd',
    '.ccd.',
    '..d..',
  ] },
  flag: { pal: { p: '#3a1a4a', P: '#5a2a6e', v: '#c08aff', w: '#6a5a4a', W: '#9a8a74' }, glow: 'v', rows: [
    'W......',
    'wpPPPPp',
    'wPPvPPp',
    'wPvvvPp',
    'wPPvPP.',
    'wpPPPp.',
    'wp.p.p.',
    'w......',
    'w......',
    'w......',
    'w......',
  ] },
  skull: { pal: { w: '#f0e6d0', W: '#b8ac90', r: '#ff3b2f' }, glow: 'wWr', rows: [
    '.www.',
    'wwwww',
    'wrwrw',
    '.wWw.',
    '.w.w.',
  ] },
};

/* ---------------------------------------------------------------------------------------------- icons for the cards */
// 9x9, drawn on a light card, so they get their own outline
export const ICONS = {
  whip: { pal: { b: '#7a4a24', B: '#a8703a', w: '#5a3a1e' }, rows: [
    '.......bb',
    '.....bb.b',
    '....b...b',
    '...b....b',
    '..b....b.',
    '.b....b..',
    'w....b...',
    'ww.......',
    'Bw.......',
  ] },
  books: { pal: { r: '#a3202e', R: '#d0404a', g: '#e2b84a', w: '#f2ece0' }, rows: [
    '..RRRRR..',
    '.RrrrrrR.',
    '.Rrgggr R'.replace(' ', 'R'),
    '.RrgrgrR.',
    '.RrgggrR.',
    '.RrrrrrR.',
    '.RwwwwwR.',
    '.RRRRRRR.',
    '.........',
  ] },
  knife: { pal: { s: '#dfe6f0', S: '#8a94a8', h: '#6a4428' }, rows: [
    '........s',
    '.......sS',
    '......sS.',
    '.....sS..',
    '....sS...',
    '..hsS....',
    '...h.....',
    '..h.h....',
    '.h.......',
  ] },
  fire: { pal: { r: '#d84a1a', o: '#ff9a2a', y: '#ffe07a', w: '#8a5a30' }, rows: [
    '.....o.r.',
    '....oyo..',
    '...royor.',
    '....ooo..',
    '....w....',
    '...w.....',
    '..w......',
    '.w.......',
    'w........',
  ] },
  axe: { pal: { s: '#dfe6f0', S: '#8a94a8', w: '#8a5a30' }, rows: [
    '..sSs....',
    '.sSSSs...',
    'sSSwSSs..',
    '.sS.wSs..',
    '.....w...',
    '......w..',
    '.......w.',
    '........w',
    '.........',
  ] },
  garlic: { pal: { w: '#f4efe0', W: '#cfc4a8', g: '#7a9a4a', p: '#b88aa0' }, rows: [
    '....g....',
    '....g....',
    '...wWw...',
    '..wwWww..',
    '.wwpWpww.',
    '.wWwWwWw.',
    '.wWwWwWw.',
    '..wWWWw..',
    '...WWW...',
  ] },
  water: { pal: { g: '#dff6ff', b: '#6ac8ff', B: '#3a7ad8', c: '#a07040' }, rows: [
    '...ccc...',
    '....g....',
    '....g....',
    '...gbg...',
    '..gbbbg..',
    '.gbbBbbg.',
    '.gbBBBbg.',
    '.gbbbbbg.',
    '..ggggg..',
  ] },
  bolt: { pal: { y: '#fff6a0', Y: '#ffd23a', b: '#8ad8ff' }, rows: [
    '.....yy..',
    '....yY...',
    '...yY....',
    '..yYYYy..',
    '....yY...',
    '...yY....',
    '..yY.....',
    '.yY......',
    '.y.......',
  ] },
  armor: { pal: { s: '#c9ccd8', S: '#8a8ea4', d: '#5a5e74' }, rows: [
    '.sS...Ss.',
    'sSSssSSSs',
    'sSsSSsSSs',
    '.sSsSsSs.',
    '.sSsSsSs.',
    '.sSSsSSs.',
    '..sSsSs..',
    '...sSs...',
    '.........',
  ] },
  heart: { pal: { r: '#a3202e', R: '#e04a4a', w: '#ffb0a0', d: '#5a0e1e' }, rows: [
    '.........',
    '.RR...RR.',
    'RwRR.RRRr',
    'RRRRRRRRr',
    'RRRdRRRrr',
    '.RRddRrr.',
    '..RRRrr..',
    '...Rrr...',
    '....r....',
  ] },
  regen: { pal: { b: '#7a5230', g: '#e2c25a', r: '#a3202e' }, rows: [
    '...b.b...',
    '..b...b..',
    '.b.....b.',
    '.b.....b.',
    '..b...b..',
    '...b.b...',
    '....g....',
    '...ggg...',
    '....g....',
  ] },
  wings: { pal: { w: '#f4efe0', W: '#c4bca8', d: '#8a8270' }, rows: [
    'W.......W',
    'wW.....Ww',
    'wwW...Www',
    '.wwWdWww.',
    '.wwwdwww.',
    '..wWdWw..',
    '...W.W...',
    '.........',
    '.........',
  ] },
  might: { pal: { s: '#dfe6f0', S: '#8a94a8', g: '#e2b84a', w: '#7a4a24' }, rows: [
    '....s....',
    '....sS...',
    '....sS...',
    '....sS...',
    '....sS...',
    '..ggggg..',
    '....w....',
    '....w....',
    '....g....',
  ] },
  tome: { pal: { b: '#3a5ab0', B: '#5a82d8', g: '#e2b84a', w: '#f2ece0' }, rows: [
    '.........',
    '.BBBBBBb.',
    '.BwwwwwBb',
    '.BwgggwBb',
    '.BwwwwwBb',
    '.BwgggwBb',
    '.BwwwwwBb',
    '.BBBBBBBb',
    '..bbbbbbb',
  ] },
  magnet: { pal: { r: '#c8343a', s: '#c9ccd8', d: '#7a2024' }, rows: [
    '.rrr.rrr.',
    'rrdr.rdrr',
    'rr.....rr',
    'rr.....rr',
    'rr.....rr',
    'rrr...rrr',
    '.rrrrrrr.',
    '..rrrrr..',
    '.........',
  ] },
  candle: { pal: { g: '#e2b84a', G: '#a87a2a', w: '#f4efe0', f: '#ffd65a' }, rows: [
    'f...f...f',
    'w...w...w',
    'w...w...w',
    'GgggGgggG',
    '....g....',
    '....g....',
    '...ggg...',
    '..GgggG..',
    '.........',
  ] },
  amount: { pal: { g: '#e2b84a', G: '#a87a2a' }, rows: [
    '.gg...gg.',
    'g..g.g..g',
    'g..gGg..g',
    'g..g.g..g',
    '.gg...gg.',
    '.........',
    '.........',
    '.........',
    '.........',
  ] },
  bread: { pal: { b: '#c88a40', B: '#e8b060', d: '#8a5a24', r: '#8a1a3a' }, rows: [
    '.......r.',
    '......rr.',
    '..bBBb.r.',
    '.bBBBBb..',
    'bBdBdBBb.',
    'bBBBBBBb.',
    '.bdddddb.',
    '.........',
    '.........',
  ] },
};

/* ---------------------------------------------------------------------------------------------- baking */
// a sprite as raw pixels: { w, h, d: RGBA }. Glow pixels get alpha 250, which the shader reads as "keeps its colour
// in the dark"; everything else is fully opaque or empty
export const GLOW_A = 250;
export function paint(rows, pal, opt = {}) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), o = opt.outline === false ? 0 : 1;
  const W = w + o * 2, H = h + o * 2, d = new Uint8ClampedArray(W * H * 4), solid = new Uint8Array(W * H);
  const glow = new Set((opt.glow || '').split(''));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i], col = ch && ch !== '.' && pal[ch];
    if (!col) continue;
    const rgb = hex(col), p = (j + o) * W + (i + o);
    d[p * 4] = rgb[0]; d[p * 4 + 1] = rgb[1]; d[p * 4 + 2] = rgb[2]; d[p * 4 + 3] = glow.has(ch) ? GLOW_A : 255; solid[p] = 1;
  }
  if (o) {
    const ink = hex(opt.ink || INK);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const p = j * W + i; if (solid[p]) continue;
      if ((i > 0 && solid[p - 1]) || (i < W - 1 && solid[p + 1]) || (j > 0 && solid[p - W]) || (j < H - 1 && solid[p + W])) {
        d[p * 4] = ink[0]; d[p * 4 + 1] = ink[1]; d[p * 4 + 2] = ink[2]; d[p * 4 + 3] = 255;
      }
    }
  }
  return { w: W, h: H, d };
}
// a quarter turn clockwise
export function rot(img) {
  const { w, h, d } = img, out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (y * w + x) * 4, t = (x * h + (h - 1 - y)) * 4; for (let k = 0; k < 4; k++) out[t + k] = d[s + k]; }
  return { w: h, h: w, d: out };
}
// for the page's own little pictures (cards, the tray): a canvas, scaled up crisply
export function toCanvas(img, s = 1, flip = false) {
  const [c, x] = mk(img.w * s, img.h * s), id = x.createImageData(img.w * s, img.h * s), D = id.data;
  for (let y = 0; y < img.h * s; y++) for (let X = 0; X < img.w * s; X++) {
    const sx = flip ? img.w - 1 - ((X / s) | 0) : (X / s) | 0, p = (((y / s) | 0) * img.w + sx) * 4, q = (y * img.w * s + X) * 4;
    D[q] = img.d[p]; D[q + 1] = img.d[p + 1]; D[q + 2] = img.d[p + 2]; D[q + 3] = img.d[p + 3] ? 255 : 0;
  }
  x.putImageData(id, 0, 0);
  return c;
}

// everything goes into one texture, packed on shelves
class Atlas {
  constructor(w = 1024, h = 512) { this.w = w; this.h = h; this.d = new Uint8Array(w * h * 4); this.x = 1; this.y = 1; this.row = 0; }
  add(img) {
    if (this.x + img.w + 1 > this.w) { this.x = 1; this.y += this.row + 1; this.row = 0; }
    if (this.y + img.h + 1 > this.h) throw new Error('atlas full');
    const u = this.x, v = this.y;
    for (let y = 0; y < img.h; y++) this.d.set(img.d.subarray(y * img.w * 4, (y + 1) * img.w * 4), ((v + y) * this.w + u) * 4);
    this.x += img.w + 1; this.row = Math.max(this.row, img.h);
    return { u, v, w: img.w, h: img.h };
  }
}

function solidImg(w, h, fn) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = fn(x, y); if (a) { const p = (y * w + x) * 4; d[p] = d[p + 1] = d[p + 2] = a === 2 ? 255 : 0; d[p + 3] = 255; } }
  return { w, h, d };
}

export function bakeAll() {
  const A = new Atlas(1024, 512), S = { atlas: A, mob: {}, hero: {}, prop: {}, kit: {}, icon: {}, img: {} };
  const frames = (def, extra) => (def.frames || [def.rows]).map(rows => paint(rows, def.pal, { glow: def.glow, ...extra }));
  for (const [k, d] of Object.entries(MOB_ART)) { const f = frames(d); S.img[k] = f[0]; S.mob[k] = { f: f.map(i => A.add(i)), w: f[0].w, h: f[0].h }; }
  for (const [k, d] of Object.entries(HERO_ART)) {
    const f = frames(d); S.img['hero_' + k] = f[0];
    S.hero[k] = { f: f.map(i => A.add(i)), w: f[0].w, h: f[0].h, fallen: A.add(rot(rot(rot(f[0])))) };
  }
  for (const [k, d] of Object.entries(PROP_ART)) { const f = frames(d); S.img['prop_' + k] = f[0]; S.prop[k] = { f: f.map(i => A.add(i)), w: f[0].w, h: f[0].h, img: f[0] }; }
  for (const [k, d] of Object.entries(KIT_ART)) {
    const f = frames(d); S.img['kit_' + k] = f[0];
    const e = { f: f.map(i => A.add(i)), w: f[0].w, h: f[0].h };
    if (k === 'axe') { let r = f[0]; e.f = []; for (let i = 0; i < 4; i++) { e.f.push(A.add(r)); r = rot(r); } }
    S.kit[k] = e;
  }
  for (const [k, d] of Object.entries(ICONS)) S.icon[k] = paint(d.rows, d.pal, { ink: '#2a1c22' });
  // a white pixel, for particles and lines, tinted per use
  S.px = A.add(solidImg(1, 1, () => 2));
  // ground shadows, black ellipses the shader draws at partial alpha
  S.shadow = {};
  for (const w of [5, 7, 9, 11, 13, 17]) { const h = Math.max(2, Math.round(w * 0.4)); S.shadow[w] = A.add(solidImg(w, h, (x, y) => (((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2 <= 1.05 ? 1 : 0))); }
  S.font = bakeFont(A);
  return S;
}
export { MOB_ART, HERO_ART, PROP_ART };

/* ---------------------------------------------------------------------------------------------- 3x5 pixel font */
const GLYPHS = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '-': '000000111000000',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101',
  X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '!': '010010010000010', '.': '000000000000010', ' ': '000000000000000', '?': '110001010000010',
};
// white glyphs with an ink rim, tinted when drawn; cells of 5x7
function bakeFont(A) {
  const out = {};
  for (const [k, g] of Object.entries(GLYPHS)) {
    const on = (i, j) => i >= 0 && i < 3 && j >= 0 && j < 5 && g[j * 3 + i] === '1';
    out[k] = A.add(solidImg(5, 7, (x, y) => on(x - 1, y - 1) ? 2 : (on(x - 2, y - 1) || on(x, y - 1) || on(x - 1, y - 2) || on(x - 1, y)) ? 1 : 0));
  }
  return out;
}
export const textW = (str, s = 1) => String(str).length * 4 * s + s;
