// Little pixel pictures for the tray and the info card: each ant from the side, the upgrades, and the extras.
// Rows of palette letters; '.' is clear.
const P = {
  k: '#1a0f0a', b: '#7c2f18', h: '#a4482a', d: '#3b150b', l: '#4f1e10',
  D: '#4a2315', E: '#6a3a24', s: '#b0661f', S: '#d68a38', n: '#c99a64', N: '#e8bf8a', o: '#2b201d', O: '#4a3a34', g: '#e3ac3c',
  q: '#6a2814', Q: '#94432a', y: '#ffd24a', w: '#ffffff', W: '#e8e2d4', a: '#8fce4a', A: '#5f9a2a', r: '#c2303e', R: '#e0505a',
  c: '#d9a55c', C: '#b07a36', t: '#9ad0ec', T: '#4a8cb0', f: '#e24c4c', F: '#3f8f4a', m: '#8a8a94', M: '#5a5a64', u: '#f0b43c', U: '#c88a18',
  e: '#6a4a30', v: '#f6f2e6', x: '#ff6a5a',
};
const ART = {
  worker: ['......d.d...', '.......dd...', '.bbb..hbb...', 'bbbbdbbbbbd.', 'bbbb.lbbb...', '.l.l.l.l....'],
  digger: ['.......D.D..', '........DD..', '.DDD..EDDD..', 'DDDDkDDDDDDk', 'DDDD.kDDDD.k', '.k.k.k.k....'],
  scout: ['.......d.d..', '........dd..', '.sss..Sss...', 'sssskssssd..', 'ssss.lsss...', '.l.l..l.l...', 'l...l....l..'],
  nurse: ['............', '.......ll...', '.nnn..Nnn...', 'nnnnlnnnnl..', 'nnnn.lnnn...', '.l.l.l.l....'],
  officer: ['......o.o...', '.......oo...', '.ooo..goo...', 'oooogOgooo..', 'oooo.goo....', '.k.k.k.k....'],
  queen: ['........y.y.', '.......yyy..', '.qqqq..Qqq..', 'qqqqqqdqqqqd', 'qqqqqq.lqq..', '.qqqq.......', '..l.l.l.l...'],
  jaws: ['.kk..kk.', 'kbbkkbbk', '.kbbbbk.', '..kbbk..', '..kbbk..', '...kk...'],
  loads: ['..cc....', '.cCCc...', '.cccc.cc', '..cc.cCc', '.....ccc', '.kkkkkk.'],
  legs: ['k.......', '.k......', '..kkk...', '....k...', '....k.kk', '....k...', '...kk...'],
  thrift: ['........', 'WWWWWWWW', 'W.cc.c.W', '.WWWWWW.', '..WWWW..', '........'],
  nose: ['k.....k.', '.k...k..', '..k.k...', '..bbb...', '.bbbbb..', '..bbb...'],
  ranch: ['..a.a...', '.aaaaa..', 'aAaaAaa.', '.aaaaa..', '..u..u..', '..u.....'],
  aphids: ['........', '.a.a..a.', 'aaaa.aaa', 'aAaa.aAa', '.a.a..a.', '...u....', '...u....'],
  feed: ['...c....', '..cCc.c.', '.c..cCc.', 'cCc..c..', '.c..cc..', '...cCc..'],
  order: ['.xxxxx..', '.x....x.', '.x.xx.x.', '.xxxxx..', '.x......', '.x......', 'kkk.....'],
  drip: ['..tt..', '.tTTt.', '.tTTt.', '..ff..', '..uu..', '...u..'],
  food: ['..cc....', '.cCCc...', '.cccc...', '..ccuu..', '...uUUu.', '....uu..'],
  ant: ['......d.d...', '.......dd...', '.bbb..hbb...', 'bbbbdbbbbbd.', 'bbbb.lbbb...', '.l.l.l.l....'],
};
export function drawIcon(canvas, name, px = 3) {
  const rows = ART[name] || ART.worker, w = Math.max(...rows.map(r => r.length)), h = rows.length;
  canvas.width = w * px; canvas.height = h * px;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && P[ch]) { g.fillStyle = P[ch]; g.fillRect(x * px, y * px, px, px); } }));
  return canvas;
}
export function iconHTML(name, px = 3, cls = 'ico') {
  const c = drawIcon(document.createElement('canvas'), name, px);
  c.className = cls;
  c.setAttribute('aria-hidden', 'true');
  return c;
}
