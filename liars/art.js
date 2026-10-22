// Linocut art: everything is black ink, cream paper, one vermilion block and one ochre block.
// Characters are SVG strings with named groups the page animates (head, pupils, mouth, and each tell).

export const INK = '#17120e', PAPER = '#efe4cc', RED = '#c4402a', OCHRE = '#d89a3c';

// a tapered carving stroke (a gouge mark) from a to b, w wide at the middle
export function gouge(x1, y1, x2, y2, w = 3, fill = PAPER, bend = 0) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const bx = mx + nx * bend, by = my + ny * bend;
  const r = n => Math.round(n * 10) / 10;
  return `<path d="M${r(x1)} ${r(y1)}Q${r(bx + nx * w)} ${r(by + ny * w)} ${r(x2)} ${r(y2)}Q${r(bx - nx * w)} ${r(by - ny * w)} ${r(x1)} ${r(y1)}Z" fill="${fill}"/>`;
}
// a run of parallel gouges, handy for hatching
function hatch(x, y, n, dx, dy, lx, ly, w, fill, jitter = 0, seed = 1) {
  let s = '', k = seed;
  const rnd = () => ((k = (k * 9301 + 49297) % 233280) / 233280 - 0.5) * jitter;
  for (let i = 0; i < n; i++) s += gouge(x + dx * i + rnd(), y + dy * i + rnd(), x + dx * i + lx + rnd(), y + dy * i + ly + rnd(), w, fill);
  return s;
}

const svg = (body, cls = '') => `<svg class="${cls}" viewBox="0 0 200 220" aria-hidden="true">${body}</svg>`;

// ---- Pip, a nervous clown
function pip() {
  return svg(`
  <g class="body">
    <path d="M24 222C28 172 58 150 100 148C142 150 172 172 176 222Z" fill="${INK}"/>
    ${hatch(40, 186, 5, 6, -6, 10, 26, 2.2, PAPER, 2, 3)}
    ${hatch(132, 162, 5, 6, 6, 8, 28, 2.2, PAPER, 2, 7)}
    <circle cx="100" cy="186" r="7" fill="${RED}"/><circle cx="100" cy="208" r="7" fill="${RED}"/>
    <path d="M58 146L66 128L74 142L82 126L90 140L100 124L110 140L118 126L126 142L134 128L142 146L128 156L114 148L100 158L86 148L72 156Z" fill="${PAPER}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <g class="head">
      <path d="M62 66C48 62 40 76 50 84C40 90 46 104 60 100C54 86 58 74 62 66Z" fill="${RED}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M138 66C152 62 160 76 150 84C160 90 154 104 140 100C146 86 142 74 138 66Z" fill="${RED}" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="100" cy="84" r="38" fill="${PAPER}" stroke="${INK}" stroke-width="3.5"/>
      ${gouge(70, 70, 76, 108, 1.4, INK, -6)}${gouge(130, 70, 124, 108, 1.4, INK, 6)}
      <path d="M86 64L95 80L86 96L77 80Z" fill="${INK}"/><path d="M114 64L123 80L114 96L105 80Z" fill="${INK}"/>
      <circle cx="86" cy="80" r="6.5" fill="${PAPER}"/><circle cx="114" cy="80" r="6.5" fill="${PAPER}"/>
      <g class="pupils"><circle cx="86" cy="81" r="3" fill="${INK}"/><circle cx="114" cy="81" r="3" fill="${INK}"/></g>
      <g class="brows"><path d="M76 60Q86 52 95 59" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M105 59Q114 52 124 60" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>
      <g class="mouth"><path d="M84 106Q92 112 100 108Q108 104 116 108" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><ellipse class="open" cx="100" cy="110" rx="8" ry="5" fill="${INK}"/></g>
      <circle cx="100" cy="94" r="9" fill="${RED}" stroke="${INK}" stroke-width="2.5"/><circle cx="97" cy="91" r="2.4" fill="${PAPER}"/>
      <path d="M72 52L100 4L128 52Z" fill="${INK}"/>
      ${gouge(86, 44, 100, 14, 2.5)}${gouge(100, 48, 108, 20, 2.5)}${gouge(112, 48, 116, 34, 2)}
      <path d="M70 52Q100 60 130 52" stroke="${PAPER}" stroke-width="3" fill="none"/>
      <circle cx="100" cy="6" r="7" fill="${RED}" stroke="${INK}" stroke-width="2.5"/>
      <g class="sweat"><path d="M136 58C143 68 146 74 146 79A10 10 0 0 1 126 79C126 74 129 68 136 58Z" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
        <path d="M64 64C69 71 71 75 71 79A7 7 0 0 1 57 79C57 75 59 71 64 64Z" fill="${PAPER}" stroke="${INK}" stroke-width="2.5"/>
        <path d="M150 40C153 45 154 47 154 49A4 4 0 0 1 146 49C146 47 147 45 150 40Z" fill="${PAPER}" stroke="${INK}" stroke-width="2"/></g>
    </g>
    <g class="hands"><ellipse cx="48" cy="210" rx="16" ry="11" fill="${PAPER}" stroke="${INK}" stroke-width="3"/><ellipse cx="152" cy="210" rx="16" ry="11" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
      ${gouge(40, 206, 40, 216, 1, INK)}${gouge(48, 205, 48, 217, 1, INK)}${gouge(152, 205, 152, 217, 1, INK)}${gouge(160, 206, 160, 216, 1, INK)}</g>
  </g>`, 'pip');
}

// ---- Mr. Sallow, a lizard in a waistcoat
function sallow() {
  return svg(`
  <g class="body">
    <path d="M22 222C26 176 56 150 100 146C144 150 174 176 178 222Z" fill="${INK}"/>
    <path d="M76 150L100 222L124 150L112 148L100 168L88 148Z" fill="${RED}"/>
    ${gouge(82, 154, 96, 206, 1.6, INK)}${gouge(118, 154, 104, 206, 1.6, INK)}
    <circle cx="100" cy="186" r="3.6" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/><circle cx="100" cy="204" r="3.6" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M104 190Q122 196 132 186" stroke="${OCHRE}" stroke-width="2" fill="none" stroke-dasharray="3 2"/>
    ${gouge(66, 156, 84, 214, 2.4)}${gouge(134, 156, 116, 214, 2.4)}
    <path d="M88 144L100 158L112 144L100 138Z" fill="${PAPER}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M84 120L84 146L118 146L120 116Z" fill="${OCHRE}" stroke="${INK}" stroke-width="3"/>
    <g class="head">
      <path d="M144 62C154 92 144 122 116 130C92 136 60 126 42 114C30 106 32 92 46 88C68 82 88 62 108 50C126 40 138 46 144 62Z" fill="${OCHRE}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M118 46L124 34L130 48L138 40L140 56L148 54L146 68" fill="${RED}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      ${[[70, 92], [84, 84], [98, 74], [92, 100], [108, 96], [124, 104], [132, 86], [116, 116], [100, 116], [80, 108], [136, 70]].map(([x, y]) => `<path d="M${x - 5} ${y}Q${x} ${y - 6} ${x + 5} ${y}" stroke="${INK}" stroke-width="2" fill="none"/>`).join('')}
      <circle cx="49" cy="96" r="2.4" fill="${INK}"/>
      <g class="tongue"><path d="M40 108L18 104M18 104L10 98M18 104L10 110" stroke="${RED}" stroke-width="3.5" stroke-linecap="round" fill="none"/></g>
      <g class="mouth"><path d="M40 108Q70 120 104 118" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><path class="open" d="M44 110Q72 128 102 120Q72 120 44 110Z" fill="${INK}"/></g>
      <circle cx="114" cy="78" r="13" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
      <g class="pupils"><ellipse cx="114" cy="78" rx="2.6" ry="9" fill="${INK}"/></g>
      <path class="lid" d="M100 74Q114 60 128 74Q114 68 100 74Z" fill="${OCHRE}" stroke="${INK}" stroke-width="2.5"/>
    </g>
    <ellipse cx="46" cy="210" rx="16" ry="10" fill="${OCHRE}" stroke="${INK}" stroke-width="3"/>
    <g class="hand">
      <path d="M148 206C154 197 172 197 180 205L182 216L146 216Z" fill="${OCHRE}" stroke="${INK}" stroke-width="3"/>
      <path d="M156 212L158 222M166 211L170 221" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <g class="finger"><path d="M178 207L196 213" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M178 207L196 213" stroke="${OCHRE}" stroke-width="4" stroke-linecap="round"/></g>
      <g class="taps">${gouge(202, 206, 212, 200, 1.8)}${gouge(203, 216, 214, 218, 1.8)}${gouge(196, 202, 198, 192, 1.8)}</g>
    </g>
  </g>`, 'sallow');
}

// ---- Captain Morrow, an old sea captain
function morrow() {
  return svg(`
  <g class="body">
    <path d="M18 222C22 172 56 148 100 146C144 148 178 172 182 222Z" fill="${INK}"/>
    ${[176, 196, 214].map(y => `<circle cx="80" cy="${y}" r="4" fill="${OCHRE}" stroke="${INK}" stroke-width="1.5"/><circle cx="120" cy="${y}" r="4" fill="${OCHRE}" stroke="${INK}" stroke-width="1.5"/>`).join('')}
    ${gouge(40, 176, 54, 220, 2.4)}${gouge(160, 176, 146, 220, 2.4)}${gouge(30, 196, 36, 220, 2)}
    <path d="M38 166L48 158L58 166L48 172Z" fill="${OCHRE}" stroke="${INK}" stroke-width="2"/><path d="M162 166L152 158L142 166L152 172Z" fill="${OCHRE}" stroke="${INK}" stroke-width="2"/>
    <g class="head">
      <ellipse cx="100" cy="86" rx="35" ry="38" fill="${PAPER}" stroke="${INK}" stroke-width="3.5"/>
      <path d="M62 92C60 120 74 160 100 170C126 160 140 120 138 92C130 112 118 116 100 116C82 116 70 112 62 92Z" fill="${PAPER}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      ${hatch(70, 118, 6, 9, 3, 4, 28, 1.3, INK, 3, 11)}
      <circle cx="78" cy="96" r="6" fill="${RED}" opacity=".55"/><circle cx="122" cy="96" r="6" fill="${RED}" opacity=".55"/>
      <g class="pupils"><ellipse cx="86" cy="84" rx="3.6" ry="3.2" fill="${INK}"/><ellipse cx="114" cy="84" rx="3.6" ry="3.2" fill="${INK}"/></g>
      <path d="M72 76Q84 66 96 74L92 78Q84 74 74 80Z" fill="${PAPER}" stroke="${INK}" stroke-width="2.5"/><path d="M128 76Q116 66 104 74L108 78Q116 74 126 80Z" fill="${PAPER}" stroke="${INK}" stroke-width="2.5"/>
      ${gouge(76, 74, 92, 70, 0.8, INK)}${gouge(124, 74, 108, 70, 0.8, INK)}
      <ellipse cx="100" cy="96" rx="9" ry="10" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
      <g class="mouth"><ellipse class="open" cx="100" cy="114" rx="7" ry="4" fill="${INK}"/></g>
      <path d="M100 106C90 102 78 106 72 114C82 112 92 114 100 110C108 114 118 112 128 114C122 106 110 102 100 106Z" fill="${PAPER}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M118 116L142 122L142 112L152 112L152 128L136 130Z" fill="${INK}" stroke="${PAPER}" stroke-width="1.5" stroke-linejoin="round"/>
      <g class="smoke"><path d="M147 108C140 98 154 92 146 82C140 74 152 68 148 58" stroke="${PAPER}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/></g>
      <path d="M58 56C58 34 80 24 100 24C120 24 142 34 142 56Z" fill="${INK}"/>
      <path d="M60 50L140 50L140 60L60 60Z" fill="${INK}" stroke="${PAPER}" stroke-width="2"/>
      ${gouge(70, 34, 92, 28, 2)}${gouge(110, 28, 128, 34, 1.6)}
      <path d="M62 60Q100 76 138 60L136 66Q100 82 64 66Z" fill="${INK}" stroke="${PAPER}" stroke-width="1.5"/>
      <g fill="none" stroke="${OCHRE}" stroke-width="2.6" stroke-linecap="round"><path d="M100 32L100 46"/><path d="M94 36L106 36"/><path d="M92 42Q100 50 108 42"/></g>
    </g>
    <ellipse cx="50" cy="210" rx="17" ry="11" fill="${PAPER}" stroke="${INK}" stroke-width="3"/><ellipse cx="150" cy="210" rx="17" ry="11" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
  </g>`, 'morrow');
}

// ---- the Widow
let uid = 0;
function widow() {
  const clip = `veil${++uid}`;
  let veil = '';
  for (let i = -6; i < 14; i++) veil += `<path d="M${46 + i * 8} 50L${90 + i * 8} 112M${154 - i * 8} 50L${110 - i * 8} 112" />`;
  return svg(`
  <defs><clipPath id="${clip}"><path d="M62 56L138 56L132 104L68 104Z"/></clipPath></defs>
  <g class="body">
    <path d="M24 222C28 176 58 150 100 148C142 150 172 176 176 222Z" fill="${INK}"/>
    <path d="M78 150L84 124L116 124L122 150Z" fill="${INK}" stroke="${PAPER}" stroke-width="1.5"/>
    ${hatch(80, 130, 7, 6, 0, 0, 16, 1.2, PAPER, 1, 5)}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => { const a = Math.PI * (0.15 + i * 0.0875); return `<circle cx="${100 - Math.cos(a) * 34}" cy="${150 + Math.sin(a) * 18}" r="3.6" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>`; }).join('')}
    ${gouge(46, 186, 60, 220, 2)}${gouge(154, 186, 140, 220, 2)}
    <g class="head">
      <path d="M64 70C60 100 62 130 70 140L130 140C138 130 140 100 136 70Z" fill="${INK}"/>
      <ellipse cx="100" cy="90" rx="30" ry="38" fill="${PAPER}" stroke="${INK}" stroke-width="3.5"/>
      <g class="pupils"><path d="M80 86Q88 80 96 86Q88 90 80 86Z" fill="${INK}"/><path d="M104 86Q112 80 120 86Q112 90 104 86Z" fill="${INK}"/></g>
      <path class="lid" d="M78 84Q88 76 98 84M102 84Q112 76 122 84" stroke="${INK}" stroke-width="2.5" fill="none"/>
      <path d="M100 90L96 102L102 102" stroke="${INK}" stroke-width="2" fill="none" stroke-linejoin="round"/>
      <g class="mouth"><path d="M90 112Q95 108 100 110Q105 108 110 112Q100 118 90 112Z" fill="${RED}" stroke="${INK}" stroke-width="1.5"/><ellipse class="open" cx="100" cy="113" rx="5" ry="3" fill="${INK}"/></g>
      <g clip-path="url(#${clip})" stroke="${INK}" stroke-width="1.1" opacity=".8">${veil}</g>
      <path d="M62 56L138 56L132 104L68 104Z" fill="none" stroke="${INK}" stroke-width="1" opacity=".5"/>
      <ellipse cx="100" cy="54" rx="72" ry="13" fill="${INK}" stroke="${PAPER}" stroke-width="1.5"/>
      <path d="M68 52C68 30 82 18 100 18C118 18 132 30 132 52Z" fill="${INK}"/>
      ${gouge(78, 30, 96, 24, 1.5)}${gouge(40, 54, 70, 60, 1.5)}${gouge(130, 60, 160, 54, 1.5)}
      <path d="M128 46C140 30 160 22 176 26C162 30 148 40 138 52Z" fill="${RED}" stroke="${INK}" stroke-width="2"/>
      ${gouge(136, 46, 170, 27, 0.8, INK)}
      <circle cx="128" cy="48" r="6" fill="${RED}" stroke="${INK}" stroke-width="2"/>
    </g>
    <ellipse cx="54" cy="210" rx="16" ry="10" fill="${INK}" stroke="${PAPER}" stroke-width="1.8"/><ellipse cx="146" cy="210" rx="16" ry="10" fill="${INK}" stroke="${PAPER}" stroke-width="1.8"/>
  </g>`, 'widow');
}

export const BUSTS = { pip, sallow, morrow, widow };

// ---- dice
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
export function die(f, cls = '') {
  return `<svg class="die ${cls}" viewBox="0 0 100 100" aria-hidden="true"><rect class="face" x="6" y="6" width="88" height="88" rx="18" stroke-width="6"/>
    ${PIPS[f].map(([x, y]) => `<circle class="pip" cx="${x}" cy="${y}" r="${f === 1 ? 13 : 10}"/>`).join('')}</svg>`;
}

export function cup() {
  return `<svg class="cupsvg" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M14 96L24 14L76 14L86 96Z" fill="${INK}" stroke="${PAPER}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="50" cy="14" rx="26" ry="6" fill="${INK}" stroke="${PAPER}" stroke-width="2.5"/>
    ${gouge(30, 30, 70, 30, 1.6, PAPER, 3)}${gouge(22, 82, 78, 82, 2, PAPER, 3)}${gouge(32, 40, 30, 72, 2.4, OCHRE)}${gouge(40, 44, 39, 66, 1.2, OCHRE)}
    <path d="M14 96Q50 104 86 96" stroke="${PAPER}" stroke-width="2.5" fill="none"/></svg>`;
}

// the hanging lamp, drawn at the top of the swinging group
export function lamp(x, y) {
  return `<g transform="translate(${x} ${y})">
    <path d="M-1.5 -2000L1.5 -2000L1.5 0L-1.5 0Z" fill="${PAPER}" opacity=".6"/>
    <path d="M-8 0L8 0L10 12L-10 12Z" fill="${INK}" stroke="${PAPER}" stroke-width="2"/>
    <path d="M-12 12L12 12L44 52L-44 52Z" fill="${INK}" stroke="${PAPER}" stroke-width="2.5" stroke-linejoin="round"/>
    ${gouge(-30, 46, -6, 18, 2.4)}${gouge(-18, 48, -2, 22, 1.4)}
    <path d="M-44 52Q0 62 44 52" stroke="${OCHRE}" stroke-width="5" fill="none"/>
    <ellipse cx="0" cy="56" rx="14" ry="8" fill="${OCHRE}"/><ellipse cx="0" cy="55" rx="7" ry="4" fill="${PAPER}"/>
  </g>`;
}

// light rays fanning down from the lamp, carved out of the black
export function rays(x, y, len, seed = 3) {
  let k = seed, s = '';
  const rnd = () => (k = (k * 9301 + 49297) % 233280) / 233280;
  // the warm cone
  s += `<path d="M${x} ${y}L${x - len * 0.62} ${y + len}L${x + len * 0.62} ${y + len}Z" fill="url(#cone)"/>`;
  for (let i = 0; i < 46; i++) {
    const a = (rnd() - 0.5) * 1.15;
    const r0 = 60 + rnd() * 70, r1 = r0 + len * (0.25 + rnd() * 0.6);
    const w = 0.8 + rnd() * 2.6;
    s += `<g opacity="${(0.05 + rnd() * 0.16).toFixed(2)}">${gouge(x + Math.sin(a) * r0, y + Math.cos(a) * r0, x + Math.sin(a) * r1, y + Math.cos(a) * r1, w)}</g>`;
  }
  return s;
}
