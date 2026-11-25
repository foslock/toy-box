// The four photographs as SVG, and where things are in them.
import { figure, path, flat, line, pearls, look, INK } from './people.js';
const C = { cream: '#f3e3c3', paper: '#fff6e2', red: '#d6452c', teal: '#2f7f6d', gold: '#f2b23e', navy: '#1c1730', rose: '#f0a58c' };
const F = (who, x, y, k, pose, when) => `<g transform="translate(${x} ${y}) scale(${k})">${figure(who, pose, when)}</g>`;
const rect = (x, y, w, h, c, e = '') => path(`M${x} ${y}h${w}v${h}h${-w}Z`, c, e);
const r0 = (x, y, w, h, c, e = '') => flat(`M${x} ${y}h${w}v${h}h${-w}Z`, c, e);
const circ = (x, y, r, c, e = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${INK}" stroke-width="5" ${e}/>`;
const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const ell = (x, y, a, b, c, e = '') => `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" fill="${c}" stroke="${INK}" stroke-width="5" ${e}/>`;
const text = (x, y, s, t, c = INK, e = '') => `<text x="${x}" y="${y}" font-size="${s}" fill="${c}" text-anchor="middle" font-family="Federo, sans-serif" ${e}>${t}</text>`;
const at = (x, y, g, e = '') => `<g transform="translate(${x} ${y}) ${e}">${g}</g>`;
const rays = (cx, cy, R, k, c, a0 = 0, a1 = 360, e = '') => { let g = ''; const st = (a1 - a0) / k; for (let i = 0; i < k; i += 2) { const p = (a) => `${(cx + Math.cos(a * Math.PI / 180) * R).toFixed(0)} ${(cy + Math.sin(a * Math.PI / 180) * R).toFixed(0)}`; g += flat(`M${cx} ${cy}L${p(a0 + i * st)}L${p(a0 + (i + 1) * st)}Z`, c, e); } return g; };
const cloud = (x, y, k, c) => at(x, y, path('M-120 0 a34 34 0 0 1 40 -44 a46 46 0 0 1 84 -14 a38 38 0 0 1 64 26 a28 28 0 0 1 32 32Z', c), `scale(${k})`);
const scallops = (x0, x1, y, w, c, o = 1) => { let d = ''; for (let x = x0; x < x1; x += w) d += `M${x} ${y} a${w / 2} ${w / 3} 0 0 0 ${w} 0 `; return line(d, 4, c, `opacity="${o}"`); };
const suitcase = (x, y, w, h, c, initials = '') => at(x, y, path(`M${w / 2 - 18} 0 v-14 h36 v14`, 'none') + rect(0, 0, w, h, c) + r0(3, h - 14, w - 6, 11, INK, 'opacity=".22"') + rect(14, 0, 12, h, C.gold, 'style="stroke-width:4"') + rect(w - 26, 0, 12, h, C.gold, 'style="stroke-width:4"') + (initials ? text(w / 2, h / 2 + 12, 30, initials, C.paper) : ''));
const beads = (x, y, r, k = 14) => { let g = ''; for (let i = 0; i < k; i++) { const a = i * 2.4, d = r * Math.sqrt(i / k); g += `<circle cx="${(x + Math.cos(a) * d).toFixed(0)}" cy="${(y + Math.sin(a) * d * 0.5).toFixed(0)}" r="6" fill="${C.paper}" stroke="${INK}" stroke-width="3"/>`; } return g; };
const placecard = (x, y, w = 46) => at(x, y, path(`M0 0 h${w} l4 22 h${-w - 4}Z`, C.paper, 'style="stroke-width:3.5"') + line(`M8 9 h${w - 18} M10 15 h${w - 24}`, 2.4));
const clock = (x, y, r, h, m) => { const a = ((h % 12) + m / 60) * 30 - 90, b = m * 6 - 90, q = (g, l) => `L${(Math.cos(g * Math.PI / 180) * l).toFixed(1)} ${(Math.sin(g * Math.PI / 180) * l).toFixed(1)}`; let t = ''; for (let i = 0; i < 12; i++) { const g = i * 30 * Math.PI / 180; t += line(`M${(Math.cos(g) * r * 0.78).toFixed(1)} ${(Math.sin(g) * r * 0.78).toFixed(1)} L${(Math.cos(g) * r * 0.9).toFixed(1)} ${(Math.sin(g) * r * 0.9).toFixed(1)}`, 4); } return at(x, y, circ(0, 0, r + 12, C.gold) + circ(0, 0, r, C.paper) + t + line(`M0 0${q(a, r * 0.5)}`, 8) + line(`M0 0${q(b, r * 0.76)}`, 5) + dot(0, 0, 6, C.red)); };

// ============ I. The landing stage ============
function landing() {
  let g = r0(0, 0, 1800, 1000, '#f9dfb0') + rays(1290, 330, 1700, 44, '#f6cf8e', 0, 360);
  g += dot(1290, 330, 120, '#f4b85a');
  g += cloud(760, 150, 1.1, C.paper) + cloud(1600, 210, .9, C.paper) + cloud(1010, 250, .6, C.paper);
  g += path('M420 560 L640 330 L760 420 L900 270 L1080 470 L1200 400 L1420 570Z', '#6fa7a0') + flat('M900 270 L1080 470 L1010 560 L900 560 L860 420Z', '#4f8a88') + flat('M640 330 L760 420 L740 560 L640 560 L600 440Z', '#4f8a88') + flat('M900 270 L860 312 L884 330 L902 316 L930 340 L948 324Z', C.paper);
  g += path('M1150 560 L1400 380 L1560 300 L1800 260 V600 H1150Z', '#3f8c74') + flat('M1560 300 L1800 260 V600 H1640Z', '#2f7261');
  // the hotel on its hill
  g += at(1545, 190, rect(0, 40, 190, 130, C.paper) + r0(120, 43, 67, 124, '#e3cfa6') + path('M-14 40 H204 L180 12 H10Z', C.red) + path('M66 12 V-34 H124 V12Z', C.paper) + path('M56 -34 H134 L95 -74Z', C.red) + [0, 1, 2, 3, 4].map((i) => rect(18 + i * 34, 62, 18, 26, '#2f5f7a', 'style="stroke-width:3"') + rect(18 + i * 34, 112, 18, 36, '#2f5f7a', 'style="stroke-width:3"')).join('') + line('M95 -74 V-104', 4) + path('M95 -104 L128 -96 L95 -86Z', C.gold, 'style="stroke-width:3"'));
  g += r0(0, 556, 1800, 444, '#3f9aa3') + line('M0 556 H1800', 5);
  for (let i = 0; i < 9; i++) g += scallops(((i * 53) % 90) - 90, 1800, 590 + i * 46, 90, i % 2 ? '#2f7f8d' : '#8fd0cd', .9);
  for (let i = 0; i < 8; i++) g += r0(1290 - [100, 70, 110, 60, 90, 50, 80, 40][i], 576 + i * 48, [200, 140, 220, 120, 180, 100, 160, 80][i], 16, '#f7cf86', 'opacity=".55"');
  // the steamer
  g += path('M-20 420 H560 L620 440 Q600 640 520 720 H-20Z', C.paper) + path('M-20 520 H607 Q590 640 520 720 H-20Z', C.red) + r0(-20, 512, 628, 10, INK) + rect(-20, 300, 440, 120, C.paper) + [0, 1, 2, 3, 4].map((i) => circ(50 + i * 82, 362, 26, '#2f5f7a')).join('') + path('M120 300 L140 120 H250 L262 300Z', C.red) + r0(133, 170, 121, 34, C.paper) + path('M137 150 L140 120 H250 L252 150Z', INK) + cloud(300, 80, .8, '#d8cdb6') + line('M0 420 V370 H560 V420 M80 420 V372 M180 420 V372 M300 420 V372 M470 420 V372', 5);
  g += text(112, 610, 30, 'VARN QUEEN', '#f3e3c3', 'letter-spacing="5"');
  g += path('M240 600 L330 570 L620 780 L540 800Z', '#b9804a') + line('M262 594 L560 792 M290 584 L590 788', 3);
  // timetable board
  g += rect(700, 390, 14, 350, '#7a4a2c') + rect(906, 390, 14, 350, '#7a4a2c') + at(0, -110, rect(672, 352, 276, 170, C.teal) + rect(690, 370, 240, 134, C.paper, 'style="stroke-width:3"') + text(810, 400, 26, 'LAST STEAMER', C.red) + line('M706 412 H914', 3) + text(770, 444, 22, 'Weekdays') + text(880, 444, 22, '10.30') + text(770, 484, 22, 'Sat. Sun.', C.red) + text(880, 484, 22, '10.00', C.red));
  // the jetty
  g += path('M-10 726 H1180 L1262 1010 H-10Z', '#c98f55') + [0, 1, 2, 3].map((i) => line(`M-10 ${776 + i * 62} H${1194 + i * 18}`, 4, '#8a5a32')).join('') + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => line(`M${80 + i * 160 + (i % 2) * 40} ${776 + (i % 3) * 62} v62`, 3, '#8a5a32')).join('') + flat('M1180 726 L1262 1010 H1230 L1150 726Z', '#a06c3a');
  g += rect(1186, 690, 46, 130, '#7a4a2c') + ell(1209, 690, 23, 9, '#a06c3a') + rect(1560, 760, 46, 260, '#7a4a2c') + ell(1583, 760, 23, 9, '#a06c3a') + rect(1690, 820, 46, 200, '#7a4a2c') + ell(1713, 820, 23, 9, '#a06c3a');
  // gull on the post
  g += at(1584, 752, path('M-46 -44 C-40 -74 0 -78 20 -62 C24 -90 56 -90 56 -66 L74 -58 L56 -52 C50 -16 10 -6 -18 -20 L-70 -14Z', C.paper) + path('M-40 -44 C-20 -60 10 -56 22 -44 C10 -22 -22 -20 -60 -20Z', '#9fb0b8') + dot(46, -68, 4, INK) + line('M-6 -14 V4 M12 -14 V4', 4, C.gold) + path('M62 -60 l26 -8 l8 14 l-26 8Z', '#e9b23e', 'style="stroke-width:3.500"'));
  // Dolly, waving from the foot of the gangway
  g += F('dolly', 300, 905, 1.16, { f: 1, hat: 'cloche', la: [[-92, -376], [-84, -468]], lh: 'spread', ra: [[62, -252], [40, -190]], mouth: 'grin', tilt: -5, ll: [[-18, -96], [-30, -12]], rl: [[28, -100], [34, -12]], rHold: path('M-6 0 q10 -40 22 0', 'none') + path('M-22 0 h44 l8 44 h-60Z', C.gold) });
  // Julian and the luggage
  g += suitcase(430, 830, 180, 120, '#7a4a2c', 'J.P.') + suitcase(452, 742, 136, 86, C.paper) + text(520, 800, 34, 'D.A.', C.red) + suitcase(470, 684, 104, 56, C.teal);
  g += F('julian', 660, 930, 1.18, { f: -1, la: [[-82, -258], [-96, -330]], lh: 'point', ra: [[70, -246], [26, -196]], mouth: 'frown', eyes: 'lid', tilt: 4, rHold: at(-14, -26, path('M-26 -22 h46 v52 h-46Z', C.paper) + line('M-18 -10 h30 M-18 2 h30 M-18 14 h20', 3)) });
  // Iris
  g += F('iris', 905, 920, 1.18, { f: 1, h: [-8, -190], s: [6, -316], la: [[-40, -256], [44, -250]], lh: 'spread', back: ['la'], ra: [[96, -290], [160, -232]], rh: 'spread', mouth: 'shock', eyes: 'wide', ll: [[-26, -100], [-46, -14]], rl: [[26, -104], [30, -12]], look: 1 });
  // Hugo, lunging
  g += F('hugo', 1120, 905, 1.2, { f: 1, hat: 'boater', s: [46, -300], h: [0, -190], tilt: 10, hd: [72, -364], back: ['la'], la: [[-10, -250], [-74, -300]], ra: [[128, -344], [176, -414]], rh: 'spread', ll: [[-74, -150], [-140, -104]], rl: [[40, -100], [22, -12]], mouth: 'shock', eyes: 'wide', look: 1 });
  // the telegram in the air
  g += at(1408, 366, path('M-44 -30 L46 -38 L52 22 L-38 32Z', '#f2d06b') + line('M-30 -14 L34 -20 M-28 0 L36 -6 M-26 14 L14 10', 3.5), 'rotate(-14)') + line('M1310 420 q20 -8 32 -22 M1316 452 q30 -8 46 -30', 4);
  // the hatbox
  g += at(1420, 850, path('M-110 40 q30 -60 60 -10 q10 -70 50 -20 q30 -54 60 4 q40 -20 50 30Z', '#bfe6e2') + at(0, 0, path('M-58 -54 Q0 -28 58 -54 L50 34 Q0 58 -50 34Z', '#f0a58c') + ell(0, -56, 62, 20, '#f6c3ac') + [-34, -12, 12, 34].map((x) => line(`M${x} -40 V34`, 5, C.red)).join('') + rect(-30, -22, 60, 34, C.paper, 'style="stroke-width:3.500"') + text(0, 4, 26, 'I.C.', INK), 'rotate(-16)') + flat('M-112 44 q28 -20 56 0 q28 20 56 0 q28 -20 56 0 q28 20 60 0 v44 h-228Z', '#3f9aa3') + line('M-130 46 q32 -24 64 0 q32 24 64 0 q32 -24 64 0 q32 24 62 0', 5) + line('M-96 -60 l-10 -24 M-40 -100 l-2 -24 M96 -70 l14 -22', 5, C.paper));
  return g;
}

// ============ II. The lobby ============
function lobby() {
  let g = r0(0, 0, 1800, 1000, '#e7a94a');
  for (let i = 0; i < 12; i++) g += r0(i * 150, 0, 75, 720, '#e09d3c');
  g += r0(0, 0, 1800, 64, '#8a2f3c') + line('M0 64 H1800', 6); for (let i = 0; i < 23; i++) g += path(`M${i * 80 - 10} 64 a40 40 0 0 0 80 0Z`, i % 2 ? '#8a2f3c' : '#b8483c');
  g += r0(0, 640, 1800, 90, '#7a4326') + line('M0 640 H1800 M0 728 H1800 M0 660 H1800', 5);
  g += r0(0, 728, 1800, 272, '#f3e3c3');
  for (let r = 0; r < 4; r++) { const y0 = 730 + [0, 42, 100, 178][r], y1 = 730 + [42, 100, 178, 280][r]; for (let i = -14; i < 14; i++) if ((i + r) % 2 === 0) { const x = (k, y) => 900 + k * (90 + (y - 730) * 0.42); g += flat(`M${x(i, y0)} ${y0} L${x(i + 1, y0)} ${y0} L${x(i + 1, y1)} ${y1} L${x(i, y1)} ${y1}Z`, '#2f6f62'); } }
  g += line('M0 730 H1800', 5);
  // key rack and roster
  g += rect(330, 170, 250, 190, '#7a4326'); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g += rect(346 + c * 56, 184 + r * 56, 48, 48, '#4d2818', 'style="stroke-width:3"'); if ((r * 4 + c) % 3) g += line(`M${370 + c * 56} ${196 + r * 56} v20`, 4, C.gold) + dot(370 + c * 56, 196 + r * 56, 7, C.gold); }
  g += text(455, 160, 30, 'KEYS', INK, 'letter-spacing="6"');
  g += rect(640, 170, 150, 200, C.paper) + r0(643, 173, 144, 34, C.red) + text(715, 199, 24, 'STAFF', C.paper, 'letter-spacing="5"') + [0, 1, 2, 3, 4].map((i) => line(`M658 ${230 + i * 27} h${[90, 110, 76, 104, 60][i]}`, 4)).join('');
  g += clock(890, 180, 58, 4, 0);
  // the portrait
  g += rect(1010, 120, 270, 400, C.gold) + rect(1030, 140, 230, 360, '#8a2f3c', 'style="stroke-width:4"') + rays(1145, 320, 250, 32, '#a43c40', 0, 360, 'clip-path="url(#pclip)"') + `<clipPath id="pclip"><path d="M1032 142h226v356h-226Z"/></clipPath><g clip-path="url(#pclip)">${F('honoria', 1140, 800, 1.18, { f: 1, noLegs: true, eyes: 'lid', la: [[-70, -230], [-30, -170]], ra: [[72, -240], [40, -300]], mouth: 'flat', top: pearls('M-18 -334 Q4 -262 20 -334') + pearls('M-20 -330 Q6 -214 24 -330') + circDot(0, -336) })}</g>` + rect(1070, 528, 150, 44, C.gold, 'style="stroke-width:4"') + line('M1086 544 h118 M1100 558 h90', 3);
  // kitchen door
  g += rect(1380, 250, 200, 478, '#5a2f1e') + rect(1398, 268, 164, 460, '#2a2440') + path('M1562 268 L1620 290 V760 L1562 728Z', '#b9804a') + circ(1592, 400, 20, '#9fd0c4') + text(1480, 236, 34, 'KITCHEN', INK, 'letter-spacing="6"');
  // mirror
  g += path('M1660 640 V300 Q1660 200 1740 190 Q1820 200 1820 300 V640Z', C.gold) + path('M1678 624 V304 Q1678 220 1740 208 Q1820 220 1820 304 V624Z', '#9fd0c4') + line('M1700 520 L1780 340 M1726 540 L1800 380', 6, '#d3efe6');
  // palm
  g += at(1050, 700, path('M-46 0 h92 l-14 80 h-64Z', C.teal) + [-70, -40, -12, 18, 48, 76].map((a) => path('M0 0 C-30 -70 -20 -150 8 -190 C30 -140 26 -60 0 0Z', '#3f8c5a', `transform="rotate(${a})"`)).join(''), 'scale(.9)');
  // Krause behind the desk
  g += F('krause', 500, 850, 1.2, { f: 1, noLegs: true, la: [[-76, -240], [-40, -196]], ra: [[94, -250], [150, -232]], rh: 'spread', mouth: 'smile', eyes: 'lid', tilt: 3, back: ['la'] });
  // Augustus
  g += F('augustus', 862, 905, 1.2, { f: -1, la: [[-112, -262], [-178, -278]], lh: 'fist', ra: [[86, -236], [64, -160]], mouth: 'frown', eyes: 'down', tilt: 6, lHold: '' });
  // the desk
  g += path('M230 560 H780 L800 600 H210Z', '#b9804a') + rect(236, 600, 540, 270, '#7a4326'); g += `<clipPath id="dclip"><path d="M240 604h532v262h-532Z"/></clipPath><g clip-path="url(#dclip)">${rays(506, 880, 400, 36, '#b8602f', 180, 360)}</g>` + path('M446 870 a60 60 0 0 1 120 0Z', C.gold);
  g += path('M600 582 L690 560 L700 588 L612 612Z', C.paper) + line('M612 584 L652 586 L690 562', 3); // envelope
  g += at(330, 566, path('M-70 -6 Q-36 -22 0 -8 Q36 -22 70 -6 L80 20 Q38 6 0 20 Q-38 6 -80 20Z', C.paper) + line('M0 -8 V20 M-56 -4 q24 -8 44 0 M-58 6 q24 -8 46 0 M14 -2 q22 -8 42 0 M14 8 q24 -8 46 0', 2.500) + path('M30 -14 L38 30 L46 22 L52 32 L44 -14Z', C.red, 'style="stroke-width:3"'));
  g += at(450, 560, path('M-60 0 L-50 -30 H50 L60 0Z', C.gold, 'style="stroke-width:4"') + text(0, -8, 20, 'A. KRAUSE', INK)) + at(738, 566, path('M-24 0 a24 24 0 0 1 48 0Z', C.gold) + dot(0, -28, 6, INK));
  // waste-paper basket
  g += at(985, 930, path('M-50 -90 H50 L38 20 H-38Z', '#b9804a') + line('M-44 -60 H44 M-42 -30 H42 M-39 0 H39 M-20 -88 L-14 18 M20 -88 L14 18 M0 -88 V18', 3) + path('M-30 -90 l10 -26 l20 10 l16 -16 l18 32Z', C.paper, 'style="stroke-width:4"'));
  // Pym at the portrait
  g += F('pym', 1240, 905, 1.16, { f: 1, s: [4, -300], h: [0, -186], hd: [14, -366], tilt: -14, la: [[-76, -220], [-44, -150]], ra: [[84, -286], [64, -378]], rh: 'fist', rHold: at(6, -8, line('M0 0 L-6 -26', 8) + `<circle cx="-12" cy="-48" r="24" fill="${C.paper}" fill-opacity=".5" stroke="${INK}" stroke-width="6"/>`, 'rotate(-6)'), mouth: 'o' });
  // Odette with the little cake
  g += F('odette', 1466, 890, 1.16, { f: 1, la: [[-54, -240], [14, -220]], ra: [[84, -240], [62, -212]], back: [], mouth: 'smile', eyes: 'down', top: at(46, -222, ell(0, 8, 54, 12, '#9fd0c4') + path('M-38 4 V-30 Q0 -42 38 -30 V4 Q0 16 -38 4Z', '#f0a58c') + path('M-38 -30 Q0 -42 38 -30 Q34 -14 24 -18 Q14 -8 4 -18 Q-8 -6 -18 -16 Q-32 -8 -38 -30Z', C.paper, 'style="stroke-width:4"') + line('M0 -38 V-60', 6, C.red) + path('M0 -62 q-9 -10 0 -24 q9 14 0 24Z', C.gold, 'style="stroke-width:3"')) });
  // Emil at the mirror
  g += F('emil', 1704, 905, 1.18, { f: 1, la: [[-74, -262], [-14, -312]], lh: 'fist', ra: [[78, -262], [18, -312]], rh: 'fist', mouth: 'flat', eyes: 'open', look: 1 });
  // Winifred in the armchair
  g += at(150, 960, path('M-150 -330 Q-150 -390 -90 -390 H100 Q160 -390 160 -330 V20 H-150Z', '#2f6f62') + path('M-150 -330 Q-150 -390 -90 -390 H-40 V20 H-150Z', '#235548', 'style="stroke:none"'));
  g += F('winifred', 150, 1010, 1.16, { f: 1, s: [0, -270], h: [4, -120], hemY: 10, flare: 1.7, noLegs: true, la: [[-70, -190], [-14, -140]], ra: [[78, -190], [52, -140]], mouth: 'smile', eyes: 'lid' });
  g += at(172, 852, rect(-70, -34, 140, 66, '#8a5fa8') + r0(-67, 4, 134, 25, '#6d4a8c') + rect(-12, -34, 24, 66, C.gold, 'style="stroke-width:4"') + path('M0 -34 q-40 -40 -44 -6 q14 14 44 6 q34 8 44 -6 q-4 -34 -44 6Z', C.gold, 'style="stroke-width:4"'));
  g += at(150, 960, path('M-160 -150 Q-160 -190 -120 -190 Q-84 -190 -84 -150 V30 H-160Z', '#3f8c7a') + path('M90 -150 Q90 -190 130 -190 Q168 -190 168 -150 V30 H90Z', '#3f8c7a'));
  // newspaper on a low table
  g += ell(690, 944, 100, 26, '#7a4326') + rect(676, 950, 28, 50, '#7a4326') + path('M620 930 L740 914 L772 938 L650 956Z', C.paper, 'style="stroke-width:4"') + line('M644 934 L720 924 M654 942 L736 931', 3);
  return g;
}
function circDot(x, y) { return `<circle cx="${x}" cy="${y}" r="7" fill="${C.gold}" stroke="${INK}" stroke-width="3"/>`; }

// ============ III. The reception ============
function ballroom() {
  const W = 2680;
  let g = r0(0, 0, W, 1000, '#23305c');
  for (let i = 0; i < 18; i++) g += r0(i * 150 + 10, 0, 70, 720, '#283867');
  // terrace arches
  for (const x of [1090, 1290]) { }
  const arch = (x, open) => path(`M${x} 720 V270 Q${x} 150 ${x + 100} 150 Q${x + 200} 150 ${x + 200} 270 V720Z`, C.gold) + path(`M${x + 16} 720 V272 Q${x + 16} 166 ${x + 100} 166 Q${x + 184} 166 ${x + 184} 272 V720Z`, '#101a3c');
  g += arch(900) + arch(1130) + `<clipPath id="ac"><path d="M916 720 V272 Q916 166 1000 166 Q1084 166 1084 272 V720ZM1146 720 V272 Q1146 166 1230 166 Q1314 166 1314 272 V720Z"/></clipPath><g clip-path="url(#ac)">${r0(900, 520, 500, 200, '#1b4a66')}${scallops(900, 1400, 550, 40, '#4f8fae', .8)}${scallops(880, 1400, 590, 40, '#4f8fae', .8)}${dot(1010, 262, 44, '#f6e6b4')}${dot(1028, 252, 40, '#101a3c')}${flat('M900 520 L1000 430 L1120 500 L1240 400 L1400 520Z', '#16264f')}${path('M1180 520 h110 l-14 34 h-84Z', C.paper, 'style="stroke-width:3"')}${rect(1208, 494, 60, 26, C.paper, 'style="stroke-width:3"')}${rect(1226, 464, 18, 30, C.red, 'style="stroke-width:3"')}${[0, 1, 2, 3].map((i) => dot(1200 + i * 22, 532, 5, C.gold)).join('')}</g>` + line('M1000 166 V720 M1230 166 V720 M916 420 H1084 M1146 420 H1314', 8, C.gold);
  g += flat('M1084 720 V272 L1120 320 V760Z', '#3b4b80') ;
  // floor
  g += r0(0, 716, W, 284, '#6b4a5c'); for (let r = 0; r < 3; r++) { let d = ''; for (let i = -1; i < 35; i++) d += `${i === -1 ? 'M' : 'L'}${i * 80} ${736 + r * 96 + (i & 1 ? 46 : 0)} `; g += line(d, 16, '#85606c') + line(d, 4, '#4d3346'); }
  g += line(`M0 716 H${W}`, 6);
  // the flash: a fan of cold light from the photographer at the bottom of the frame
  g += `<g opacity=".5">${rays(1300, 1130, 2000, 40, '#9fb2ea', 182, 358)}</g>` + `<clipPath id="fc"><path d="M0 716H${W}V1000H0Z"/></clipPath><g opacity=".35" clip-path="url(#fc)">${rays(1300, 1130, 2000, 40, '#ffe7a0', 182, 358)}</g>`;
  // cornice
  g += r0(0, 0, W, 60, '#8a2f3c') + line(`M0 60 H${W}`, 6); for (let i = 0; i < 34; i++) g += path(`M${i * 80 - 10} 60 a40 40 0 0 0 80 0Z`, i % 2 ? C.gold : '#b8483c');
  // unlit chandelier
  g += at(700, 60, line('M0 0 V60', 8) + [0, 1, 2].map((r) => path(`M${-150 + r * 46} ${60 + r * 44} H${150 - r * 46} L${126 - r * 46} ${100 + r * 44} H${-126 + r * 46}Z`, ['#5a6596', '#4a5588', '#3b467a'][r]) + [0, 1, 2, 3, 4, 5].map((i) => line(`M${(-120 + r * 46) + i * (240 - r * 92) / 5} ${64 + r * 44} v32`, 3)).join('')).join('')) + at(2250, 60, line('M0 0 V50', 8) + [0, 1, 2].map((r) => path(`M${-150 + r * 46} ${50 + r * 40} H${150 - r * 46} L${126 - r * 46} ${88 + r * 40} H${-126 + r * 46}Z`, ['#5a6596', '#4a5588', '#3b467a'][r])).join(''));
  // service door and fuse cupboard
  g += rect(30, 240, 190, 476, '#5a2f1e') + rect(48, 258, 154, 458, '#3b2436') + text(126, 226, 30, 'SERVICE', C.paper, 'letter-spacing="5"') + rect(250, 330, 130, 190, '#7d88a8') + rect(264, 344, 102, 162, '#2a2440') + rect(276, 360, 34, 60, C.paper, 'style="stroke-width:3"') + rect(320, 360, 34, 60, C.paper, 'style="stroke-width:3"') + path('M380 330 L440 300 V500 L380 520Z', '#97a2c0') + line('M300 470 L270 440', 12, INK) + line('M300 470 L270 440', 6, C.red) + [0, 1, 2, 3, 4, 5].map((i) => line(`M315 430 l${Math.cos(i) * 34} ${Math.sin(i * 1.7) * 34}`, 5, C.gold)).join('');
  g += clock(580, 400, 46, 9, 41);
  // Emil, lever pulled
  g += F('emil', 205, 905, 1.2, { f: 1, la: [[-74, -250], [-64, -160]], ra: [[86, -296], [66, -376]], rh: 'fist', mouth: 'grit', eyes: 'wide', look: -1, tilt: -4 });
  // seating plan easel
  g += line('M420 930 L470 600 L520 930 M470 600 V900', 12) + rect(392, 620, 156, 196, C.paper) + text(470, 654, 26, 'SEATING', C.red) + line('M412 664 H528', 3) + [0, 1, 2, 3, 4, 5].map((i) => circ(420 + i * 20, 690, 7, C.gold, 'style="stroke-width:3"')).join('') + circ(470, 756, 34, '#f0a58c', 'style="stroke-width:3.5"') + line('M420 712 H520', 3);
  // Krause at the back
  g += F('krause', 800, 800, 1.02, { f: 1, la: [[-66, -350], [-34, -390]], lh: 'spread', ra: [[70, -250], [20, -250]], rh: 'fist', mouth: 'shock', eyes: 'wide', rHold: circ(4, -10, 16, C.gold) });
  // Pym and table two
  g += F('pym', 650, 900, 1.14, { f: -1, la: [[-100, -290], [-150, -330]], lh: 'point', ra: [[78, -230], [40, -180]], mouth: 'o', eyes: 'wide', tilt: -6, lHold: '' , rHold: at(0, 0, path('M-24 -8 h44 v24 h-44Z', C.paper, 'style="stroke-width:3.5"') + line('M-14 2 h24', 3)) }, 'eve');
  g += path('M560 790 Q690 760 820 790 L836 1010 H544Z', C.paper) + ell(690, 790, 132, 28, '#fffdf3') + line('M600 830 V1000 M660 836 V1000 M730 836 V1000 M790 828 V1000', 3, '#d9c7a4') + at(640, 782, path('M-12 0 L-16 -44 H16 L12 0Z', '#e7d27a') + line('M0 0 V14 M-14 14 H14', 4)) + placecard(700, 776) + at(770, 780, ell(0, 4, 34, 8, '#9fd0c4'));
  // Odette and the trolley
  g += F('odette', 925, 920, 1.16, { f: 1, s: [20, -312], h: [0, -190], la: [[-46, -330], [-30, -420]], lh: 'spread', ra: [[92, -250], [130, -216]], mouth: 'shock', eyes: 'wide', look: 1, tilt: 6, ll: [[-22, -90], [-40, -12]] });
  g += line('M1085 690 H1300 M1100 690 V940 M1285 690 V940', 14) + line('M1085 690 H1300 M1100 690 V940 M1285 690 V940', 6, C.gold) + rect(1088, 748, 210, 16, C.gold) + rect(1088, 880, 210, 16, C.gold) + circ(1104, 950, 18, INK) + circ(1282, 950, 18, INK) + circ(1104, 950, 7, C.gold) + circ(1282, 950, 7, C.gold);
  // the cake, coming apart in the air
  const tier = (x, y, w, h, rot, c) => at(x, y, path(`M${-w} ${-h / 2} V${h / 2} Q0 ${h / 2 + 22} ${w} ${h / 2} V${-h / 2}Z`, C.paper) + path(`M${-w} ${-h / 2} Q0 ${-h / 2 + 22} ${w} ${-h / 2} Q${w * .9} ${h * .1} ${w * .68} ${-h * .05} Q${w * .5} ${h * .4} ${w * .25} ${0} Q0 ${h * .45} ${-w * .25} 0 Q${-w * .5} ${h * .4} ${-w * .68} ${-h * .05} Q${-w * .9} ${h * .1} ${-w} ${-h / 2}Z`, c, 'style="stroke-width:4"') + ell(0, -h / 2, w, 17, C.paper), `rotate(${rot})`);
  g += tier(1218, 690, 92, 70, 14, '#f0a58c') + tier(1256, 590, 72, 62, 24, '#9fd0c4') + tier(1306, 500, 54, 54, 38, '#f2b23e') + tier(1366, 428, 36, 44, 56, '#f0a58c');
  g += at(1428, 388, path('M-30 8 Q0 22 30 8 L24 -2 H-24Z', C.paper, 'style="stroke-width:4"') + path('M0 -4 V-46 L26 -8Z', C.red, 'style="stroke-width:4"'), 'rotate(60)');
  g += [[1170, 560, 14], [1200, 500, 9], [1370, 540, 12], [1400, 640, 16], [1340, 690, 10], [1440, 500, 8], [1150, 640, 8], [1450, 580, 11]].map(([x, y, r]) => circ(x, y, r, C.paper, 'style="stroke-width:4"')).join('') + ell(1330, 968, 70, 14, C.paper) + ell(1400, 956, 30, 9, C.paper);
  // bandstand
  g += path('M1610 720 H1990 L2000 800 H1590Z', '#8a2f3c') + at(1810, 722, [0, 1, 2, 3, 4, 5, 6].map((i) => path('M0 0 L-44 -330 Q0 -396 44 -330Z', i % 2 ? C.gold : '#b8483c', `transform="rotate(${-60 + i * 20}) scale(${1 - Math.abs(i - 3) * 0.12})"`)).join(''));
  g += at(1868, 722, circ(0, -72, 68, C.red) + circ(0, -72, 55, C.paper) + text(0, -90, 24, 'TEDDY') + text(0, -64, 22, 'MARLOWE') + text(0, -42, 13, '&amp; his Lakesiders'));
  g += line('M1650 800 V620', 10) + path('M1612 560 H1692 L1684 630 H1604Z', '#2a2440') + path('M1624 566 H1682 L1676 620 H1618Z', C.paper, 'style="stroke-width:3"') + line('M1630 580 h40 M1628 592 h40 M1627 604 h26', 3);
  g += F('teddy', 1762, 802, 1.04, { f: -1, la: [[-84, -262], [-64, -304]], ra: [[76, -262], [2, -268]], mouth: 'o', eyes: 'lid', look: 1, tilt: 4, top: at(-30, -330, line('M0 -40 L-84 70', 18) + line('M0 -40 L-84 70', 9, '#6a63a0') + path('M-76 56 L-102 70 L-82 92 L-66 72Z', C.gold, 'style="stroke-width:4"') + line('M-20 -14 l8 6 M-34 6 l8 6 M-48 26 l8 6', 4, C.gold)) });
  // Iris, mid-run
  g += F('iris', 1480, 925, 1.18, { f: -1, s: [-24, -306], h: [0, -192], hd: [-40, -368], tilt: 10, sway: 34, la: [[-76, -270], [-104, -210]], lh: 'spread', ra: [[52, -262], [86, -190]], back: ['ra'], rHold: at(20, 10, suitcase(-60, 0, 100, 66, C.paper) + text(-10, 46, 28, 'D.A.', C.red), 'rotate(-14)'), ll: [[-64, -130], [-96, -40]], rl: [[44, -110], [116, -64]], mouth: 'shock', eyes: 'wide' }, 'eve');
  // the head table
  const hx = [2040, 2150, 2258, 2362, 2466, 2598];
  g += F('winifred', hx[0] - 5, 900, .98, { f: 1, la: [[-64, -240], [-40, -190]], ra: [[70, -270], [34, -352]], noLegs: true, mouth: 'frown', eyes: 'wide', rHold: at(0, -6, circ(-8, -4, 10, C.gold) + circ(12, -6, 10, C.gold)) }, 'eve');
  g += F('julian', hx[1], 900, 1, { f: 1, noLegs: true, la: [[-66, -246], [-58, -180]], ra: [[70, -250], [12, -272]], mouth: 'frown', eyes: 'wide', look: 1 }, 'eve');
  g += F('dolly', hx[2], 900, 1, { f: -1, noLegs: true, hemY: -120, flare: 1, la: [[-46, -260], [-16, -330]], ra: [[50, -240], [60, -180]], mouth: 'o', eyes: 'wide', tilt: -3, look: 1 }, 'eve');
  g += F('augustus', hx[3] - 6, 900, .98, { f: -1, noLegs: true, la: [[-70, -240], [-40, -180]], ra: [[80, -240], [70, -180]], mouth: 'o', eyes: 'wide', tilt: -4 }, 'eve');
  g += F('honoria', hx[4], 905, 1, { f: 1, noLegs: true, hemY: -120, flare: 1, la: [[-62, -250], [-22, -300]], lh: 'spread', ra: [[58, -240], [48, -180]], mouth: 'shock', eyes: 'lid', tilt: 4, top: pearls('M-16 -332 Q-2 -280 24 -300 Q44 -316 62 -336') });
  g += F('hugo', hx[5], 905, 1.02, { f: -1, noLegs: true, s: [-10, -318], hd: [-26, -386], tilt: 4, back: ['ra'], la: [[-76, -276], [-70, -338]], lh: 'fist', ra: [[60, -250], [40, -180]], mouth: 'grit', eyes: 'open', look: 1 }, 'eve');
  g += [[2534, 520], [2556, 500], [2510, 606], [2546, 620], [2524, 650]].map(([x, y]) => circ(x, y, 6, C.paper, 'style="stroke-width:3"')).join('');
  g += path('M1960 730 H2690 V1010 H1936Z', C.paper) + path('M1960 730 H2690 V762 Q2650 806 2610 762 Q2570 806 2530 762 Q2490 806 2450 762 Q2410 806 2370 762 Q2330 806 2290 762 Q2250 806 2210 762 Q2170 806 2130 762 Q2090 806 2050 762 Q2005 806 1954 762Z', '#f2b23e');
  g += line('M2010 800 V1000 M2090 800 V1000 M2170 800 V1000 M2250 800 V1000 M2330 800 V1000 M2410 800 V1000 M2490 800 V1000 M2570 800 V1000 M2640 800 V1000', 3, '#d9c7a4');
  g += [0, 1, 2, 3, 4].map((i) => placecard(hx[i] - 24, 722)).join('') + placecard(hx[5] - 40, 722, 54);
  g += [2095, 2204, 2312, 2532].map((x) => at(x, 728, path('M-9 0 L-13 -34 H13 L9 0Z', '#e7d27a', 'style="stroke-width:4"') + line('M0 0 V12 M-10 12 H10', 4))).join('');
  g += at(2414, 728, path('M-7 4 V-30 H7 V4Z', C.red, 'style="stroke-width:4"') + ell(0, 6, 20, 6, C.gold));
  return g;
}

// ============ IV. Breakfast ============
function breakfast() {
  let g = r0(0, 0, 1800, 1000, '#bfe0d8') + rays(330, 420, 1900, 48, '#d6ebdc', 0, 360) + dot(330, 420, 90, '#fbe3a4');
  g += path('M-20 520 L180 360 L320 440 L520 300 L760 470 L940 380 L1180 500 L1400 360 L1640 470 L1820 400 V560 H-20Z', '#8fb5c9') + flat('M520 300 L760 470 L740 540 L520 540 L470 420Z', '#739fb8') + flat('M1400 360 L1640 470 L1600 550 H1400 L1360 440Z', '#739fb8');
  g += r0(0, 530, 1800, 140, '#5fb0b5') + line('M0 530 H1800', 5) + scallops(-30, 1800, 556, 80, '#a6dcd8') + scallops(-60, 1800, 590, 80, '#3f8c98') + scallops(-10, 1800, 622, 80, '#a6dcd8');
  g += at(1250, 548, path('M-70 0 H70 L52 26 H-56Z', C.paper, 'style="stroke-width:4"') + rect(-20, -22, 50, 22, C.paper, 'style="stroke-width:3"') + rect(0, -44, 14, 22, C.red, 'style="stroke-width:3"'), 'scale(.7)');
  // balustrade and terrace
  g += r0(0, 640, 1800, 360, '#f3e3c3'); g += rect(-10, 600, 1820, 30, C.paper) + rect(-10, 730, 1820, 24, '#e3cfa6'); for (let i = 0; i < 23; i++) g += path(`M${i * 82 + 12} 630 q-14 46 0 60 q-10 10 -4 40 h40 q6 -30 -4 -40 q14 -14 0 -60Z`, C.paper, 'style="stroke-width:4"');
  g += r0(0, 756, 1800, 244, '#e9c9a0'); for (let i = -6; i < 30; i++) g += line(`M${i * 110} 756 L${900 + (i * 110 - 900) * 1.5} 1000`, 4, '#cfa676'); g += line('M0 756 H1800 M0 820 H1800 M0 900 H1800', 4, '#cfa676') + line('M0 756 H1800', 5);
  // awning
  for (let i = 0; i < 15; i++) g += path(`M${i * 130 - 70} -10 h130 v110 a65 46 0 0 1 -130 0Z`, i % 2 ? C.paper : C.red);
  // Hugo with the net
  g += F('hugo', 225, 915, 1.14, { f: -1, la: [[-84, -258], [-110, -320]], lh: 'fist', ra: [[60, -250], [-30, -240]], rh: 'fist', mouth: 'frown', eyes: 'down', tilt: 8, top: line('M-128 -480 L10 -140', 12) + line('M-128 -480 L10 -140', 5, '#b9804a') + path('M-150 -476 q-30 80 10 120 q50 -20 46 -110Z', '#fff6e2', 'fill-opacity=".7"') + ell(-122, -478, 34, 12, 'none') + dot(-136, -390, 7, C.paper) + dot(-122, -380, 7, C.paper) }, 'morn');
  // Krause leaving
  g += F('krause', 1716, 905, 1.1, { f: 1, la: [[-70, -240], [-74, -160]], ra: [[70, -262], [100, -200]], mouth: 'frown', eyes: 'down', tilt: 6, hat: null, ll: [[-30, -100], [-58, -20]], rl: [[34, -102], [44, -12]] });
  g += suitcase(1590, 735, 110, 84, '#7a2438', 'A.K.');
  // the long table, people behind
  g += F('augustus', 470, 930, 1.1, { f: 1, noLegs: true, la: [[-86, -230], [-50, -170]], ra: [[84, -240], [40, -190]], mouth: 'frown', eyes: 'closed', tilt: 8, back: [] }, 'morn');
  g += F('honoria', 630, 930, 1.08, { f: -1, noLegs: true, hemY: -120, flare: 1, la: [[-56, -260], [-70, -330]], lh: 'spread', ra: [[62, -240], [26, -290]], rh: 'mitt', mouth: 'o', eyes: 'wide', tilt: -4, look: -1 }, 'morn');
  g += F('winifred', 790, 930, 1.06, { f: 1, noLegs: true, la: [[-64, -240], [-20, -200]], ra: [[70, -240], [30, -206]], mouth: 'smile', eyes: 'lid', tilt: 4 }, 'morn');
  g += F('dolly', 950, 930, 1.1, { f: 1, noLegs: true, hemY: -120, flare: 1, la: [[-58, -250], [-28, -316]], lh: 'spread', ra: [[58, -240], [20, -300]], mouth: 'shock', eyes: 'wide', tilt: -6, top: pearls('M-18 -334 Q2 -262 20 -334') + pearls('M-22 -332 Q4 -224 24 -332') }, 'morn');
  g += F('julian', 1080, 930, 1.1, { f: -1, noLegs: true, la: [[-92, -262], [-112, -220]], ra: [[66, -240], [50, -170]], mouth: 'grin', eyes: 'open' }, 'morn');
  g += path('M380 730 H1190 L1216 800 V1010 H350 V800Z', C.paper) + path('M380 730 H1190 L1206 772 H366Z', '#fffdf3') + path('M366 772 H1206 L1216 800 V830 Q1176 866 1136 830 Q1096 866 1056 830 Q1016 866 976 830 Q936 866 896 830 Q856 866 816 830 Q776 866 736 830 Q696 866 656 830 Q616 866 576 830 Q536 866 496 830 Q456 866 416 830 Q380 862 350 830 V800Z', '#8fc9c0');
  // table things
  g += at(520, 748, path('M-16 6 L-10 -14 H10 L16 6Z', C.gold, 'style="stroke-width:4"') + path('M-14 -14 q14 -36 28 0 l-8 -6 l-6 8 l-6 -8Z', C.paper, 'style="stroke-width:4"') + line('M20 -2 q14 4 18 14', 5, C.gold));
  g += at(680, 690, path('M-22 -6 H22 L14 22 H-14Z', C.paper, 'style="stroke-width:4"') + line('M22 0 q16 4 -4 14', 4) + path('M-10 -8 q-30 -20 -40 6 q18 2 22 14Z', '#a8692f', 'style="stroke-width:3"'), 'rotate(-40)') + [[640, 730, 7], [655, 752, 5], [626, 756, 6]].map(([x, y, r]) => dot(x, y, r, '#a8692f')).join('');
  g += at(820, 746, path('M-58 -22 H58 Q52 24 0 26 Q-52 24 -58 -22Z', '#8fb8c9') + ell(0, -22, 58, 14, C.paper) + beads(0, -24, 42, 20));
  g += at(950, 752, rect(-66, -6, 132, 26, '#8a5fa8', 'style="stroke-width:4"') + path('M-66 -6 L-54 -44 H78 L66 -6Z', '#6d4a8c', 'style="stroke-width:4"') + text(8, -18, 26, 'V', C.gold));
  g += at(1085, 752, line('M-40 6 H40 M-40 6 V-8 M40 6 V-8', 5) + [-24, -2, 20].map((x) => path(`M${x - 6} 4 V-34 Q${x + 6} -46 ${x + 18} -34 V4Z`, '#d9a05a', 'style="stroke-width:4"')).join('') + path('M-10 -44 l26 -4 l4 30 l-12 -8 l-8 10Z', '#e9d8b0', 'style="stroke-width:3"') + flat('M8 -22 l12 -2 l-2 12 l-8 2Z', '#4d2818'));
  // Pym leaning in from the front
  g += F('pym', 1250, 930, 1.12, { f: -1, s: [-26, -302], h: [0, -186], hd: [-40, -366], tilt: 8, la: [[-96, -252], [-190, -262]], lh: 'fist', ra: [[60, -226], [44, -150]], mouth: 'o', eyes: 'open', look: 1, lHold: at(0, -16, line('M0 14 L-8 -14', 8) + `<circle cx="-14" cy="-32" r="20" fill="${C.paper}" fill-opacity=".5" stroke="${INK}" stroke-width="6"/>`) });
  // the empty chair and its card
  g += at(1010, 1000, path('M-70 0 V-190 Q-70 -240 0 -240 Q70 -240 70 -190 V0Z', '#2f6f62') + [-36, 0, 36].map((x) => line(`M${x} -222 V-60`, 6)).join('') + rect(-70, -70, 140, 22, '#3f8c7a')) + at(986, 786, path('M0 0 h66 l6 30 h-72Z', C.paper, 'style="stroke-width:4"') + line('M10 10 h40 M6 10 h52', 2.500, C.red) + line('M14 20 h36', 3));
  // Odette and Emil
  g += F('odette', 1420, 915, 1.12, { f: 1, la: [[-40, -240], [50, -270]], ra: [[92, -290], [96, -352]], rh: 'mitt', mouth: 'smile', eyes: 'closed', tilt: -6 });
  g += F('emil', 1560, 915, 1.14, { f: -1, la: [[-70, -246], [-56, -186]], ra: [[70, -250], [34, -260]], mouth: 'o', eyes: 'wide', tilt: 6, hd: [-8, -384], rHold: at(-18, -6, path('M-26 -32 h44 v56 h-44Z', C.paper, 'style="stroke-width:4"') + line('M-18 -20 h28 M-18 -8 h28 M-18 4 h18', 3)) });
  // post tray
  g += rect(1300, 846, 130, 14, '#7a4326') + line('M1316 860 V990 M1414 860 V990', 8) + at(1362, 838, path('M-40 8 L-30 -14 H40 L34 8Z', '#f2d06b', 'style="stroke-width:4"') + line('M-20 -6 h44 M-24 2 h40', 3));
  return g;
}

// Spots: [id, x, y, w, h] is the touch box; the marker sits at mx,my. who = a person.
export const SCENES = {
  landing: { w: 1800, h: 1000, draw: landing, when: 'day', start: [.17, .5], spots: [
    { id: 'dolly', who: 'dolly', b: [180, 350, 210, 560], m: [330, 640] },
    { id: 'luggage', b: [420, 660, 195, 295], m: [520, 890] },
    { id: 'julian', who: 'julian', b: [600, 430, 160, 510], m: [650, 640] },
    { id: 'board', b: [670, 240, 280, 175], m: [690, 250] },
    { id: 'iris', who: 'iris', b: [810, 420, 230, 510], m: [905, 680] },
    { id: 'hugo', who: 'hugo', b: [1030, 400, 220, 510], m: [1150, 620] },
    { id: 'telegram', b: [1330, 300, 160, 130], m: [1410, 366] },
    { id: 'hatbox', b: [1310, 740, 220, 190], m: [1410, 800] },
    { id: 'gull', b: [1510, 650, 180, 130], m: [1590, 700] } ] },
  lobby: { w: 1800, h: 1000, draw: lobby, when: 'day', spots: [
    { id: 'winifred', who: 'winifred', b: [60, 500, 190, 320], m: [150, 730] },
    { id: 'parcel', b: [95, 815, 160, 75], m: [172, 866] },
    { id: 'krause', who: 'krause', b: [410, 340, 180, 200], m: [500, 500] },
    { id: 'register', b: [245, 535, 170, 60], m: [300, 562] },
    { id: 'roster', b: [635, 165, 160, 210], m: [715, 290] },
    { id: 'envelope', b: [595, 552, 115, 66], m: [652, 590] },
    { id: 'augustus', who: 'augustus', b: [730, 400, 240, 510], m: [870, 640] },
    { id: 'basket', b: [930, 815, 110, 140], m: [985, 890] },
    { id: 'paper', b: [590, 905, 200, 70], m: [690, 935] },
    { id: 'portrait', b: [1005, 115, 280, 330], m: [1250, 160] },
    { id: 'pym', who: 'pym', b: [1170, 450, 190, 460], m: [1240, 660] },
    { id: 'odette', who: 'odette', b: [1390, 360, 190, 540], m: [1450, 730] },
    { id: 'minicake', b: [1465, 530, 120, 120], m: [1520, 612] },
    { id: 'emil', who: 'emil', b: [1620, 400, 180, 510], m: [1704, 640] } ] },
  ballroom: { w: 2680, h: 1000, draw: ballroom, when: 'eve', start: [.52, .5], spots: [
    { id: 'emil', who: 'emil', b: [110, 400, 150, 510], m: [205, 640] },
    { id: 'fuse', b: [250, 320, 190, 200], m: [345, 385] },
    { id: 'plan', b: [385, 610, 170, 215], m: [470, 756] },
    { id: 'pym', who: 'pym', b: [560, 420, 170, 350], m: [650, 640] },
    { id: 'pymcard', b: [690, 765, 75, 45], m: [722, 800] },
    { id: 'krause', who: 'krause', b: [735, 340, 130, 400], m: [800, 560] },
    { id: 'odette', who: 'odette', b: [860, 380, 190, 540], m: [935, 700] },
    { id: 'cake', b: [1130, 360, 320, 360], m: [1262, 590] },
    { id: 'steamer', b: [1165, 445, 140, 110], m: [1182, 500] },
    { id: 'iris', who: 'iris', b: [1385, 440, 170, 420], m: [1470, 690] },
    { id: 'suitcase', b: [1505, 690, 150, 130], m: [1562, 775] },
    { id: 'setlist', b: [1600, 550, 100, 90], m: [1650, 596] },
    { id: 'teddy', who: 'teddy', b: [1705, 350, 130, 450], m: [1775, 600] },
    { id: 'winifred', who: 'winifred', b: [1985, 420, 105, 290], m: [2035, 650] },
    { id: 'julian', who: 'julian', b: [2095, 440, 105, 270], m: [2150, 650] },
    { id: 'dolly', who: 'dolly', b: [2205, 440, 100, 270], m: [2258, 650] },
    { id: 'augustus', who: 'augustus', b: [2310, 440, 100, 270], m: [2360, 650] },
    { id: 'honoria', who: 'honoria', b: [2415, 400, 105, 310], m: [2460, 660] },
    { id: 'hugo', who: 'hugo', b: [2525, 440, 150, 270], m: [2600, 650] },
    { id: 'hugocard', b: [2545, 712, 90, 45], m: [2585, 750] } ] },
  breakfast: { w: 1800, h: 1000, draw: breakfast, when: 'morn', spots: [
    { id: 'hugo', who: 'hugo', b: [70, 380, 240, 540], m: [225, 660] },
    { id: 'augustus', who: 'augustus', b: [390, 440, 150, 280], m: [470, 640] },
    { id: 'honoria', who: 'honoria', b: [560, 440, 140, 280], m: [630, 640] },
    { id: 'winifred', who: 'winifred', b: [720, 400, 140, 310], m: [790, 640] },
    { id: 'bowl', b: [760, 705, 120, 80], m: [820, 756] },
    { id: 'dolly', who: 'dolly', b: [880, 440, 140, 250], m: [950, 640] },
    { id: 'case', b: [880, 700, 150, 80], m: [925, 752] },
    { id: 'julian', who: 'julian', b: [1020, 440, 120, 250], m: [1070, 640] },
    { id: 'toast', b: [1040, 700, 95, 70], m: [1066, 752] },
    { id: 'chaircard', b: [975, 780, 100, 60], m: [1020, 812] },
    { id: 'pym', who: 'pym', b: [1180, 440, 160, 490], m: [1250, 700] },
    { id: 'post', b: [1300, 805, 130, 65], m: [1362, 840] },
    { id: 'odette', who: 'odette', b: [1350, 400, 140, 390], m: [1420, 720] },
    { id: 'emil', who: 'emil', b: [1495, 430, 125, 420], m: [1565, 730] },
    { id: 'krause', who: 'krause', b: [1625, 430, 150, 480], m: [1700, 690] },
    { id: 'kcase', b: [1585, 718, 118, 105], m: [1645, 800] } ] },
};
