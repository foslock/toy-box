// Chunky 12x12 pixel sprites, painted from strings, with palette swaps for the band.

const PAL = {
  k: '#1a1014', w: '#f6efe4', s: '#e0a476', H: '#3b2216', G: '#ffc63d', R: '#d8322a', W: '#efe8da',
  y: '#b9c3cf', t: '#d9a35c', B: '#3b6fd6', O: '#f28c28', o: '#ffd66b', V: '#7a3fb0', g: '#a8741c',
  Y: '#ffe16b', C: '#2a2a35', r: '#ff5b3a', b: '#49d3ff', P: '#8a4fc8', T: '#f2e3c2', D: '#4a3a3a',
  A: '#463a40', M: '#6e5c64', E: '#a8949c', L: '#8bd45a', N: '#2f8a3a',
};

export const ART = {
  player: [
    '...kkkkkk...',
    '..kHHHHHHk..',
    '.kHHHHHHHHk.',
    '.kHHssssHHk.',
    '.kHskssksHk.',
    '..kssssssk..',
    '...kwGGwk...',
    '..kwwwwwwk..',
    '.kswkwwkwsk.',
    '..kwwkkwwk..',
    '..kwk..kwk..',
    '.kkkk..kkkk.',
  ],
  snare: [
    '..t......t..',
    '...t....t...',
    '....t..t....',
    '..kkkkkkkk..',
    '.kWWWWWWWWk.',
    '.kRRRRRRRRk.',
    '.kRywRRwyRk.',
    '.kRRkRRkRRk.',
    '.kRRRRRRRRk.',
    '..kkkkkkkk..',
    '...k....k...',
    '..kk....kk..',
  ],
  tom: [
    '..kkkkkkkk..',
    '.kWWWWWWWWk.',
    'kWWWWWWWWWWk',
    'kBBBBBBBBBBk',
    'kBwkBBBBwkBk',
    'kBBBBBBBBBBk',
    'kByBBkkBByBk',
    'kBBBkBBkBBBk',
    'kByBBBBBByBk',
    'kBBBBBBBBBBk',
    '.kkkkkkkkkk.',
    '.kk......kk.',
  ],
  shaker: [
    '....kkkk....',
    '...kOOOOk...',
    'k.kOoOOoOk.k',
    'kkkOwkOwkOkk',
    'kVkOOOOOOkVk',
    'kVVkOoOOkVVk',
    '.kVVkOOkVVk.',
    '..kk.kTk.kk.',
    '.....kTk....',
    '.....kTk....',
    '.....kTk....',
    '......k.....',
  ],
  horn: [
    '..kkkkkkkk..',
    '.kGGGGGGGGk.',
    'kGggggggggGk',
    '.kGggggggGk.',
    '..kGGGGGGk..',
    '..kGwkGwkGk.',
    '...kGGGGk...',
    '....kGGk....',
    '...kkGGkk...',
    '..kGGkkGGk..',
    '..kkk..kkk..',
    '............',
  ],
  dummy: [
    '....kkkk....',
    '...kTTTTk...',
    '...kTkkTk...',
    '...kTTTTk...',
    '....kTTk....',
    '..kkkTTkkk..',
    '.kTTTTTTTTk.',
    '..kkkTTkkk..',
    '....kTTk....',
    '....kttk....',
    '....kttk....',
    '..kkkkkkkk..',
  ],
  bass: [
    '..........kk',
    '.........kyk',
    '........kyk.',
    '.......kyk..',
    '......kyk...',
    '..kk.kyk....',
    '.kRRkyk.....',
    'kRRRyk......',
    'kRRRRRk.....',
    '.kRwRRk.....',
    '..kRRk......',
    '...kk.......',
  ],
  hats: [
    '............',
    '..kkkkkkkk..',
    '.kYYYYYYYYk.',
    '..kkkkkkkk..',
    '.kYYYYYYYYk.',
    '..kkkkkkkk..',
    '.....kk.....',
    '.....kk.....',
    '.....kk.....',
    '....k..k....',
    '...k....k...',
    '..k......k..',
  ],
  lead: [
    '............',
    '............',
    'kkkkkkkkkkkk',
    'kCCCCCCCCCCk',
    'kCrCGCbCCCCk',
    'kkkkkkkkkkkk',
    'kwwkwwkwwkwk',
    'kwwkwwkwwkwk',
    'kwwwwwwwwwwk',
    'kkkkkkkkkkkk',
    '............',
    '............',
  ],
  choir: [
    '...YYYYYY...',
    '..Y......Y..',
    '...YYYYYY...',
    '....kkkk....',
    '...kssssk...',
    '..kskssksk..',
    '..kssssssk..',
    '..ksskksk...',
    '...kssssk...',
    '..kPPPPPPk..',
    '.kPPwPPwPPk.',
    '.kPPPPPPPPk.',
  ],
  kick: [
    '...kkkkkk...',
    '..kWWWWWWk..',
    '.kWWWWWWWWk.',
    '.kWRRRRRRWk.',
    'kWWRWWWWRWWk',
    'kWWRWkkWRWWk',
    'kWWRWWWWRWWk',
    '.kWRRRRRRWk.',
    '.kWWWWWWWWk.',
    '..kWWWWWWk..',
    '.k.kkkkkk.k.',
    'k..........k',
  ],
  tape: [
    '............',
    '............',
    'kkkkkkkkkkkk',
    'kTTTTTTTTTTk',
    'kTkkTTTTkkTk',
    'kTkwkTTkwkTk',
    'kTkkTTTTkkTk',
    'kTTTTTTTTTTk',
    'kDDDDDDDDDDk',
    'kkkkkkkkkkkk',
    '............',
    '............',
  ],
  speaker: [
    'kkkkkkkkkkkk',
    'kAAAAAAAAAAk',
    'kAAAkkkkAAAk',
    'kAAkMEEMkAAk',
    'kAAAkkkkAAAk',
    'kAAkkkkkkAAk',
    'kAkMMMMMMkAk',
    'kAkMkEEkMkAk',
    'kAkMkEEkMkAk',
    'kAkMMMMMMkAk',
    'kAAkkkkkkAAk',
    'kkkkkkkkkkkk',
  ],
  crown: [
    'G..G..G',
    'GG.G.GG',
    'GGGGGGG',
  ],
};

// the band are the floor's monsters in stage clothes
const SWAP = {
  drummer: ['snare', { R: '#ffc63d', y: '#d8322a', W: '#fff7e0' }],
  bassist: ['tom', { B: '#8a4fc8', y: '#ffc63d' }],
  guitar: ['horn', { G: '#ff5b3a', g: '#9a2a1c' }],
  singer: ['shaker', { O: '#4fbf5a', o: '#c8f07a', V: '#ff5bb0' }],
};

const cache = new Map();
export function sprite(name, flash) {
  const key = name + (flash ? '!' : '');
  let c = cache.get(key);
  if (c) return c;
  let rows = ART[name], swap = {};
  if (SWAP[name]) { rows = ART[SWAP[name][0]]; swap = SWAP[name][1]; }
  c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((r, yy) => [...r].forEach((ch, xx) => {
    if (ch === '.') return;
    x.fillStyle = flash ? (ch === 'k' ? '#1a1014' : '#ffffff') : (swap[ch] || PAL[ch] || '#f0f');
    x.fillRect(xx, yy, 1, 1);
  }));
  cache.set(key, c);
  return c;
}

export function draw(ctx, name, x, y, size, o = {}) {
  const img = sprite(name, o.flash);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, -size / 2, -size, size, size * img.height / img.width);
  ctx.restore();
}
