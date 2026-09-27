// The farm's pixel art: the colours of every kind of dirt, and the little things buried in it. A buried thing is a
// sprite of palette letters ('.' is dirt showing through); the world stamps its cells into the grid, and each cell
// remembers its colour as an index into THING_COLORS.

// Dirt, darkest to lightest. A cell's `aux` byte picks its shade.
export const RAMPS = {
  1: ['#34200f', '#402815', '#4b311b', '#573a21', '#634428'],     // topsoil
  2: ['#5a3a21', '#684429', '#764f30', '#835a38', '#906541'],     // loam
  3: ['#a07a46', '#af8852', '#bd965e', '#c9a36b', '#d4b07a'],     // sand
  4: ['#743822', '#844128', '#944b2f', '#a25636', '#ae6340'],     // clay
  5: ['#574c43', '#675b51', '#786c60', '#8a7e70', '#9d9282'],     // gravel
  7: ['#2e2e36', '#4a4a55', '#65656f', '#80808a', '#a2a2ab'],     // rock: outline, shadow, body, lit, highlight
  9: ['#4d3219', '#6a4726', '#86603a'],                            // root
};

// Buried things. Sizes are in cells (an ant is about four cells long).
const THINGS_SRC = {
  marble: { name: 'a glass marble', pal: { o: '#16305c', d: '#1f4f9e', b: '#2f74d6', l: '#6aa8f0', w: '#f2f8ff', s: '#ff8a3d', S: '#c65a1c' },
    art: ['..ooo..', '.olwbo.', 'olwlbdo', 'olsbbdo', 'obssSdo', '.odSdo.', '..ooo..'] },
  shell: { name: 'a snail shell', pal: { k: '#3d2414', c: '#7a4a26', b: '#b07a45', a: '#d9a86a', w: '#f1d7a8' },
    art: ['..kkkkk..', '.kaawwak.', 'kaakkkbak', 'kakbaakbk', 'kakbkkcbk', 'kaccbbbk.', '.kkcccck.', '...kkkk..'] },
  cap: { name: 'a bottle cap', pal: { r: '#d23a3a', R: '#8e1f24', w: '#f4e9d8', s: '#f7a3a3' },
    art: ['.R.RR.R.', 'RrrsrrrR', '.rswwwr.', 'RrwrrrwR', 'RrwrrrwR', '.rwwwwr.', 'RrrrrrrR', '.R.RR.R.'] },
  button: { name: 'a lost button', pal: { T: '#1d5f59', t: '#2f8f86', l: '#6cc9bf', h: '#0c2b28' },
    art: ['..TTT..', '.TlltT.', 'TlhthtT', 'TtttttT', 'TththtT', '.TtttT.', '..TTT..'] },
  bone: { name: 'a little bone', pal: { w: '#efe6cf', W: '#c9bd9e' },
    art: ['.ww.....ww.', 'wwwwwwwwwwW', '.WwwwwwwWW.', 'wWWWWWWWWWW', '.WW.....WW.'] },
  key: { name: 'an old key', pal: { y: '#e0b040', Y: '#a87a1c', w: '#fff0b0' },
    art: ['.yyy........', 'yw.yyyyyyyyy', 'y..YYYYYYYYY', '.YYY...Y.YY.'] },
  coin: { name: 'a penny', pal: { c: '#c77a3a', C: '#8c4d20', l: '#f0b27a' },
    art: ['..CCC..', '.CllcC.', 'CllcccC', 'CccCccC', 'CcccccC', '.CcccC.', '..CCC..'] },
  fossil: { name: 'a fossil', pal: { g: '#8e8a80', G: '#5f5b52', l: '#bdb8aa' },
    art: ['..GGGGG..', '.GlllllG.', 'GlGGGGGlG', 'GlGlllGlG', 'GlGlGlGlG', 'GlGlGGGlG', 'GlGllllGG', '.GlGGGGG.', '..GGGG...'] },
  soldier: { name: 'a toy soldier', pal: { g: '#58843b', G: '#35521f', l: '#86b25f' },
    art: ['..Gg...', '.GgG...', '..lg...', '.ggg.G.', 'ggggGG.', 'g.ggG..', '..gg...', '..gg...', '.g..g..', '.g..g..', 'Gg..Gg.'] },
  arrowhead: { name: 'an arrowhead', pal: { f: '#6b6f78', F: '#474a52', l: '#a3a9b4' },
    art: ['...l...', '..lff..', '..lff..', '.lfffF.', '.lffFF.', 'lfffFFF', '.ffFFF.', '..f.F..', '..f.F..'] },
  shard: { name: 'a bit of old pot', pal: { t: '#b8653a', T: '#8a4526', s: '#2e2a26', l: '#d88a5a' },
    art: ['.lllt....', 'lttttttT.', 'ssssssssT', 'tttttttTT', '.TTTTTTT.', '...TTT...'] },
};

export const THING_COLORS = [];            // hex strings; a THING cell's aux is an index into this
const colorIndex = new Map();
function idx(hex) {
  if (!colorIndex.has(hex)) { colorIndex.set(hex, THING_COLORS.length); THING_COLORS.push(hex); }
  return colorIndex.get(hex);
}
// Each thing as { id, name, w, h, cells: [[dx, dy, colorIndex]] }
export const THINGS = Object.entries(THINGS_SRC).map(([id, t]) => {
  const cells = [];
  t.art.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cells.push([x, y, idx(t.pal[ch])]); }));
  return { id, name: t.name, w: Math.max(...t.art.map(r => r.length)), h: t.art.length, cells };
});
export const THING_BY_ID = Object.fromEntries(THINGS.map(t => [t.id, t]));
// Twigs are drawn as lines, in these browns.
export const TWIG = [idx('#4a3320'), idx('#6b4b2c'), idx('#8a6640')];

export const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
