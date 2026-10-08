// The printed things: card faces, card backs, the regulars' portraits and the bar's goods, all as SVG/HTML strings.
import { isRed, rankLabel, rankName, SUIT_NAME } from './cards.js';

// Suit shapes on a 100×100 box, defined once in the page and drawn with <use>.
export const SUIT_PATHS = [
  'M50 5C60 22 93 38 93 62c0 16-15 25-30 19-4-2-7-5-9-8 1 10 5 17 13 21H33c8-4 12-11 13-21-2 3-5 6-9 8-15 6-30-3-30-19C7 38 40 22 50 5z',
  'M50 93C41 83 6 61 6 34 6 18 18 8 31 8c9 0 16 6 19 14 3-8 10-14 19-14 13 0 25 10 25 26 0 27-35 49-44 59z',
  'M50 4Q67 29 88 50 67 71 50 96 33 71 12 50 33 29 50 4z',
  'M50 9a19 19 0 0 1 16 29 19 19 0 1 1 1 33c-5 0-9-2-12-4 1 11 4 18 11 27H34c7-9 10-16 11-27-3 2-7 4-12 4a19 19 0 1 1 1-33A19 19 0 0 1 50 9z',
];
export const suitDefs = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${SUIT_PATHS.map((d, s) => `<symbol id="s${s}" viewBox="0 0 100 100"><path d="${d}"/></symbol>`).join('')}</defs></svg>`;
export const pip = (s, cls = '') => `<svg class="pipsvg ${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#s${s}"/></svg>`;

// Court cards: a bust in a frame, two inks and a mustard, the hat telling you who it is.
function court(r, s) {
  const ink = isRed(s) ? 'var(--red)' : 'var(--ink)';
  const hat = {
    11: `<path d="M17 25c2-8 9-12 15-12s12 3 13 9c-9-2-19-1-28 3z" fill="${ink}"/><path d="M42 16c6-6 11-6 14-3-5 0-8 3-11 6z" fill="var(--mustard)"/>`,
    12: `<path d="M18 36c-3-14 3-24 12-24s15 10 12 24c-2-7-5-11-12-11s-10 4-12 11z" fill="var(--ink)"/><path d="M20 22l3-8 4 5 3-8 3 8 4-5 3 8z" fill="var(--mustard)" stroke="var(--ink)" stroke-width="1"/>`,
    13: `<path d="M19 24V11l5 6 6-9 6 9 5-6v13z" fill="var(--mustard)" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round"/><circle cx="30" cy="18" r="1.8" fill="${ink}"/><path d="M21 37c1 9 5 13 9 13s8-4 9-13c-3 3-6 4-9 4s-6-1-9-4z" fill="${ink}"/>`,
  }[r];
  return `<svg class="court" viewBox="0 0 60 72" aria-hidden="true">
    <rect x="3" y="3" width="54" height="66" rx="3" fill="none" stroke="${ink}" stroke-width="1.4"/>
    <path d="M7 69c1-14 10-20 23-20s22 6 23 20z" fill="${ink}"/>
    <path d="M24 49l6 8 6-8z" fill="var(--mustard)"/>
    <circle cx="30" cy="33" r="10.5" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.4"/>
    <circle cx="26.5" cy="32" r="1.3" fill="var(--ink)"/><circle cx="33.5" cy="32" r="1.3" fill="var(--ink)"/>
    <path d="M27 38q3 2 6 0" fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-linecap="round"/>
    ${hat}
    <use href="#s${s}" x="44" y="54" width="10" height="10" fill="var(--paper)"/>
  </svg>`;
}

const MARK = { bonus: '<i class="mk chip">+30</i>', mult: '<i class="mk mul">+4</i>', glass: '<i class="mk glass">×1.5</i>', wild: `<i class="mk wild">${[0, 1, 2, 3].map(s => pip(s)).join('')}</i>` };
export const markText = { bonus: '+30 Chips when it scores', mult: '+4 Mult when it scores', glass: '×1.5 Mult when it scores; may shatter', wild: 'Counts as every suit' };

export function cardHTML(c, extra = '') {
  const red = isRed(c.s), face = c.r >= 11 && c.r <= 13;
  const mid = face ? court(c.r, c.s) : c.r === 14 ? `<span class="acering">${pip(c.s)}</span>` : pip(c.s, 'big');
  return `<div class="card ${red ? 'red' : 'blk'}${c.e ? ' e-' + c.e : ''}${c.x ? ' stranger' : ''}${extra}" data-id="${c.id}" role="img" aria-label="${rankName(c.r)} of ${SUIT_NAME[c.s]}${c.x ? ', a stranger’s card' : ''}">
    <span class="ix"><b>${rankLabel(c.r)}</b>${pip(c.s)}</span><span class="mid">${mid}</span>${c.e ? MARK[c.e] : ''}</div>`;
}
export const backHTML = (extra = '') => `<div class="card back${extra}" aria-hidden="true"><span class="emb">5<i>×</i>5</span></div>`;
// The Masquerade: the back, with the suit showing through a cut-out.
export const maskHTML = c => `<div class="card back masked" role="img" aria-label="a masked ${SUIT_NAME[c.s].toLowerCase().slice(0, -1)}"><span class="eye ${isRed(c.s) ? 'red' : 'blk'}">${pip(c.s)}<b>?</b></span></div>`;

// ---- the regulars
// Each portrait is put together from a few parts: background, coat, skin, hair, hat and a feature or two.
const P = {
  al: { bg: '#d39b3c', coat: '#3b3a46', skin: '#e8b48c', hair: 'bald', extra: ['cigar', 'brows'], stache: 'walrus' },
  rusty: { bg: '#5f7d6b', coat: '#7a4a2a', skin: '#f0c49c', hair: 'curly', hairC: '#c4512a', beard: 'full', beardC: '#c4512a' },
  rosa: { bg: '#a63c3c', coat: '#2b2b33', skin: '#c98d68', hair: 'bun', hairC: '#2a1a14', extra: ['rose', 'lips'] },
  dolores: { bg: '#3f6f8f', coat: '#d8a646', skin: '#8d5a3e', hair: 'long', hairC: '#1d1410', extra: ['earrings', 'lips'] },
  spike: { bg: '#2f2f38', coat: '#59322f', skin: '#efc6a6', hair: 'spiky', hairC: '#e9e2cf', extra: ['scar'] },
  clem: { bg: '#79894b', coat: '#3a4b2e', skin: '#e2ae86', hat: 'bowler', hatC: '#2b2622', stache: 'pencil' },
  duchess: { bg: '#7e5b94', coat: '#e7dcc6', skin: '#f2d2bb', hair: 'up', hairC: '#b9b2a8', hat: 'tiara', extra: ['pearls', 'lips'] },
  ace: { bg: '#4f7fa8', coat: '#6e4b2e', skin: '#e5b48e', hat: 'pilot', extra: ['goggles', 'grin'] },
  shorty: { bg: '#c56f3e', coat: '#4b5a6e', skin: '#f2c8a4', hat: 'newsboy', hatC: '#8a7a5c', extra: ['freckles', 'grin'] },
  bouncer: { bg: '#3c3c44', coat: '#16161a', skin: '#6b4430', hair: 'bald', extra: ['shades', 'neck'] },
  banker: { bg: '#2f5d4f', coat: '#22222a', skin: '#f1cfb2', hat: 'tophat', hatC: '#19191d', extra: ['monocle', 'bowtie'], stache: 'handlebar' },
  sal: { bg: '#b04a3a', coat: '#f1ece0', skin: '#d9a07a', hair: 'slick', hairC: '#1a1412', stache: 'handlebar', extra: ['bowtie'] },
  pinstripe: { bg: '#4a3f66', coat: 'stripe', skin: '#e8bb96', hat: 'fedora', hatC: '#30303a', extra: ['tie', 'smirk'] },
  triplets: { bg: '#cf9d54', many: 3, coat: '#3d5a80', skin: '#f0c7a5', hair: 'short', hairC: '#6b3f22' },
  hustler: { bg: '#9a3b5b', coat: '#c79a3c', skin: '#cf9671', hat: 'porkpie', hatC: '#3a2f28', extra: ['toothpick', 'smirk'] },
  lucky: { bg: '#3f8155', coat: '#a9a089', skin: '#f1c6a1', hat: 'flatcap', hatC: '#2f5a3a', extra: ['clover', 'grin'] },
  snake: { bg: '#556b3a', coat: '#202528', skin: '#d8b08c', hair: 'slick', hairC: '#0f0f10', extra: ['shades', 'smirk', 'tie'] },
  mel: { bg: '#d0703a', coat: '#3a3530', skin: '#c48a64', hair: 'bob', hairC: '#7a2d1e', extra: ['match', 'lips'] },
  oldtom: { bg: '#6b7a86', coat: '#5a4a3a', skin: '#f2d0b8', hat: 'flatcap', hatC: '#4a4038', beard: 'full', beardC: '#eeeae0', extra: ['brows'] },
  accountant: { bg: '#8c8c6a', coat: '#f0ece2', skin: '#efcfb3', hair: 'short', hairC: '#5a4a3c', hat: 'visor', extra: ['glasses', 'sleeve'] },
  zora: { bg: '#4b2d5e', coat: '#a3364a', skin: '#b67a55', hat: 'turban', hatC: '#d7a43e', extra: ['earrings', 'lips', 'gem'] },
  mechanic: { bg: '#c4a23a', coat: '#3b5f7c', skin: '#d9a47e', hat: 'hardhat', extra: ['grease', 'grin'] },
  twins: { bg: '#d47f8f', many: 2, coat: '#2b3d63', skin: '#f3d1b8', hair: 'bob', hairC: '#1c1814', extra: ['lips'] },
  widow: { bg: '#24242a', coat: '#0e0e10', skin: '#efd9cc', hair: 'up', hairC: '#121214', hat: 'veil', extra: ['lips', 'pearls'] },
  moe: { bg: '#a5643a', coat: '#e9e1cf', skin: '#e3ab84', hair: 'bald', stache: 'walrus', extra: ['suspenders', 'brows'] },
  prof: { bg: '#3e5f73', coat: '#3c3226', skin: '#f0cdb0', hat: 'mortar', hair: 'short', hairC: '#9a9a9a', extra: ['glasses', 'bowtie'], beard: 'goatee', beardC: '#a8a8a8' },
  lou: { bg: '#7d3a2e', coat: '#2e2a26', skin: '#d9a582', hat: 'fedora', hatC: '#5a4630', extra: ['grin', 'hand'] },
  mayor: { bg: '#2c4f7a', coat: '#1d1d24', skin: '#f0c9ab', hat: 'tophat', hatC: '#141418', extra: ['sash', 'brows'], stache: 'walrus' },
  gambler: { bg: '#8b5b2b', coat: '#24201c', skin: '#d6a07a', hat: 'cowboy', hatC: '#4a3524', extra: ['stubble', 'smirk', 'stringtie'] },
};

function head(o, cx, cy, k) {
  const g = [], S = (d, f, more = '') => g.push(`<path d="${d}" fill="${f}" ${more}/>`);
  const T = (x, y) => `translate(${cx} ${cy}) scale(${k}) translate(${x} ${y})`;
  const hairC = o.hairC || '#2a201a';
  // hair behind the head
  if (o.hair === 'long') S('M-14 -6c-2 14-1 24 2 30h24c3-6 4-16 2-30-4-8-24-8-28 0z', hairC);
  if (o.hair === 'bun' || o.hair === 'up') S('M-6 -20a7 7 0 1 1 12 0', hairC);
  if (o.hair === 'bob') S('M-14 -4c0-12 6-17 14-17s14 5 14 17v8h-28z', hairC);
  g.push(`<ellipse cx="-12.5" cy="1" rx="2.6" ry="3.6" fill="${o.skin}"/><ellipse cx="12.5" cy="1" rx="2.6" ry="3.6" fill="${o.skin}"/>`);
  g.push(`<ellipse cx="0" cy="0" rx="12" ry="14" fill="${o.skin}"/>`);
  // hair on top
  const top = {
    short: 'M-12 -4c-1-9 5-14 12-14s13 5 12 14c-3-5-7-7-12-7s-9 2-12 7z',
    slick: 'M-12 -3c-1-10 5-15 12-15 8 0 13 5 12 15-3-7-9-9-14-8 3 1 4 3 4 5-6-3-10-2-14 3z',
    curly: 'M-13 -2c-4-6 0-13 5-13 1-4 9-6 12-2 4-3 11 0 10 5 4 3 3 9 0 10-5-5-10-6-14-6s-9 1-13 6z',
    spiky: 'M-12 -4l-2-10 6 4 1-10 5 8 3-10 3 10 5-8 1 10 6-4-2 10c-4-4-8-5-13-5s-9 1-13 5z',
    bun: 'M-12 -3c0-9 5-13 12-13s12 4 12 13c-3-5-7-6-12-6s-9 1-12 6z',
    up: 'M-12 -3c0-9 5-13 12-13s12 4 12 13c-3-5-7-6-12-6s-9 1-12 6z',
    bob: 'M-13 2c0-12 5-16 13-16s13 4 13 16c-2-6-6-10-13-10s-11 4-13 10z',
    long: 'M-12 -2c0-10 5-14 12-14s12 4 12 14c-3-6-7-8-12-8s-9 2-12 8z',
  }[o.hair];
  if (top) S(top, hairC);
  // face
  const ex = 4.6, ey = -1;
  if (o.extra?.includes('shades')) g.push(`<rect x="-10" y="-4" width="8.5" height="5" rx="2" fill="#111"/><rect x="1.5" y="-4" width="8.5" height="5" rx="2" fill="#111"/><path d="M-1.5 -2h3" stroke="#111" stroke-width="1.2"/>`);
  else g.push(`<circle cx="${-ex}" cy="${ey}" r="1.35" fill="#1a1412"/><circle cx="${ex}" cy="${ey}" r="1.35" fill="#1a1412"/>`);
  if (o.extra?.includes('brows')) g.push(`<path d="M-8 -5.5l6 1M8 -5.5l-6 1" stroke="#2a1d16" stroke-width="1.6" stroke-linecap="round"/>`);
  if (o.extra?.includes('glasses')) g.push(`<circle cx="${-ex}" cy="${ey}" r="3.6" fill="none" stroke="#2a2420" stroke-width="1.1"/><circle cx="${ex}" cy="${ey}" r="3.6" fill="none" stroke="#2a2420" stroke-width="1.1"/><path d="M-1 -1h2" stroke="#2a2420" stroke-width="1.1"/>`);
  if (o.extra?.includes('monocle')) g.push(`<circle cx="${ex}" cy="${ey}" r="3.8" fill="rgba(255,255,255,.25)" stroke="#c8a24a" stroke-width="1.1"/><path d="M${ex + 3} ${ey + 3}q2 8-3 14" stroke="#c8a24a" stroke-width=".8" fill="none"/>`);
  if (o.extra?.includes('goggles')) g.push(`<rect x="-11" y="-13" width="22" height="6" rx="3" fill="#6b4a2e"/><circle cx="-5" cy="-10" r="3.2" fill="#bcd6e0" stroke="#3a2a1c"/><circle cx="5" cy="-10" r="3.2" fill="#bcd6e0" stroke="#3a2a1c"/>`);
  if (o.extra?.includes('freckles')) g.push(`<g fill="#b8774f"><circle cx="-6" cy="3" r=".7"/><circle cx="-4" cy="4.5" r=".7"/><circle cx="6" cy="3" r=".7"/><circle cx="4" cy="4.5" r=".7"/></g>`);
  if (o.extra?.includes('scar')) g.push(`<path d="M6 -8l3 9" stroke="#a3524a" stroke-width="1"/>`);
  if (o.extra?.includes('grease')) g.push(`<path d="M-9 4q3 1 5 0" stroke="#3b3b3b" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`);
  if (o.extra?.includes('stubble')) g.push(`<path d="M-9 4c2 8 6 9 9 9s7-1 9-9c-3 3-6 4-9 4s-6-1-9-4z" fill="#3a2a20" opacity=".25"/>`);
  if (o.beard === 'full') S('M-12 1c0 12 6 18 12 18s12-6 12-18c-3 4-6 5-12 5s-9-1-12-5z', o.beardC || hairC);
  if (o.beard === 'goatee') S('M-3 8c0 5 1 8 3 8s3-3 3-8c-2 1-4 1-6 0z', o.beardC || hairC);
  // mouth
  const lips = o.extra?.includes('lips'), grin = o.extra?.includes('grin'), smirk = o.extra?.includes('smirk');
  if (grin) g.push(`<path d="M-5 6q5 5 10 0z" fill="#fff" stroke="#3a1d16" stroke-width="1"/>`);
  else if (smirk) g.push(`<path d="M-4 7q4 1 7-2" fill="none" stroke="#3a1d16" stroke-width="1.3" stroke-linecap="round"/>`);
  else if (lips) g.push(`<path d="M-3.5 6.5q3.5 3 7 0q-3.5-1.4-7 0z" fill="#b3242a"/>`);
  else g.push(`<path d="M-3.5 7h7" stroke="#3a1d16" stroke-width="1.2" stroke-linecap="round"/>`);
  if (o.stache === 'walrus') S('M-8 6c2-4 5-4 8-3 3-1 6-1 8 3-3 1-6 0-8-1-2 1-5 2-8 1z', o.beardC || '#3a2a20');
  if (o.stache === 'pencil') g.push(`<path d="M-5 4.6h10" stroke="#2a1d16" stroke-width="1.1"/>`);
  if (o.stache === 'handlebar') S('M-10 3c3 3 6 2 10 1 4 1 7 2 10-1-1 4-6 5-10 3-4 2-9 1-10-3z', '#2a1d16');
  if (o.extra?.includes('cigar')) g.push(`<rect x="3" y="6.5" width="11" height="3" rx="1.2" fill="#7b4a2a" transform="rotate(-12 3 8)"/><circle cx="14.5" cy="5.6" r="1.4" fill="#e06b2c"/>`);
  if (o.extra?.includes('toothpick')) g.push(`<path d="M3 7l9 -2" stroke="#e3c58a" stroke-width="1"/>`);
  if (o.extra?.includes('match')) g.push(`<path d="M3 7l9 -4" stroke="#e8d3a0" stroke-width="1.1"/><circle cx="12.5" cy="2.8" r="1.6" fill="#c0392b"/><path d="M12.5 1c-2-3 0-5 1-7 1 2 2 4-1 7z" fill="#f2a33a"/>`);
  if (o.extra?.includes('earrings')) g.push(`<circle cx="-12.5" cy="6" r="1.8" fill="#d7a43e"/><circle cx="12.5" cy="6" r="1.8" fill="#d7a43e"/>`);
  if (o.extra?.includes('rose')) g.push(`<circle cx="9" cy="-12" r="3.6" fill="#c0392b"/><path d="M7 -12q2-2 4 0" stroke="#7a1d1d" fill="none"/><path d="M11 -9l3 3" stroke="#3f7a3a" stroke-width="1.4"/>`);
  // hats
  const hc = o.hatC || '#2a2420';
  const hat = {
    bowler: `<path d="M-11 -8c0-9 5-13 11-13s11 4 11 13z" fill="${hc}"/><ellipse cx="0" cy="-8" rx="15" ry="2.6" fill="${hc}"/>`,
    fedora: `<ellipse cx="0" cy="-9" rx="18" ry="3.4" fill="${hc}"/><path d="M-11 -9c0-7 3-12 6-12 2 0 3 2 5 2s3-2 5-2c3 0 6 5 6 12z" fill="${hc}"/><path d="M-11 -11.5h22v2.5h-22z" fill="#1a1412" opacity=".55"/>`,
    tophat: `<rect x="-10" y="-30" width="20" height="21" rx="1.5" fill="${hc}"/><rect x="-10" y="-14" width="20" height="3" fill="#8a2f2f"/><ellipse cx="0" cy="-9" rx="16" ry="3" fill="${hc}"/>`,
    flatcap: `<path d="M-13 -6c0-9 6-13 13-13 8 0 13 5 14 10l4 2c-6 1-12 1-19 1h-12z" fill="${hc}"/>`,
    newsboy: `<path d="M-14 -7c-1-9 6-14 14-14s15 5 14 14z" fill="${hc}"/><path d="M-6 -7h20l3 2h-23z" fill="#3a3326"/><circle cx="0" cy="-20" r="1.6" fill="#3a3326"/>`,
    porkpie: `<ellipse cx="0" cy="-9" rx="15" ry="2.8" fill="${hc}"/><path d="M-10 -9v-8c3-2 17-2 20 0v8z" fill="${hc}"/><path d="M-10 -12h20v2h-20z" fill="#d7a43e"/>`,
    cowboy: `<path d="M-21 -11c4 4 9 4 21 4s17 0 21-4c-2 5-9 7-21 7s-19-2-21-7z" fill="${hc}"/><path d="M-11 -8c-1-8 2-14 5-14l6 3 6-3c3 0 6 6 5 14z" fill="${hc}"/><path d="M-10 -10h20v2h-20z" fill="#2a1d16" opacity=".6"/>`,
    pilot: `<path d="M-13 2c-1-14 5-20 13-20s14 6 13 20c-2-6-4-10-13-10s-11 4-13 10z" fill="#6e4b2e"/>`,
    hardhat: `<path d="M-12 -7c0-9 5-14 12-14s12 5 12 14z" fill="#e8b631"/><rect x="-15" y="-8" width="30" height="3" rx="1.5" fill="#d29d1f"/><path d="M-1 -20h2v12h-2z" fill="#d29d1f"/>`,
    visor: `<path d="M-14 -6c4-5 24-5 28 0l-3 4c-6-3-16-3-22 0z" fill="rgba(52,140,80,.85)"/><path d="M-13 -6c4-3 22-3 26 0" stroke="#1d4a2c" stroke-width="1.2" fill="none"/>`,
    tiara: `<path d="M-9 -13l3-6 3 4 3-7 3 7 3-4 3 6z" fill="#e9c75d" stroke="#8a6a1e" stroke-width=".8"/><circle cx="0" cy="-17" r="1.3" fill="#3f8fbf"/>`,
    veil: `<path d="M-9 -13c0-5 4-7 9-7s9 2 9 7z" fill="#0d0d0f"/><path d="M-12 -12c3-2 21-2 24 0v12c-6 2-18 2-24 0z" fill="url(#mesh)" opacity=".85"/>`,
    turban: `<path d="M-14 -4c-2-12 6-19 14-19s16 7 14 19c-4-4-9-6-14-6s-10 2-14 6z" fill="${hc}"/><path d="M-12 -9c6-6 18-8 25-3M-13 -4c7-6 19-6 26-2" stroke="#a87a22" stroke-width="1.3" fill="none"/>`,
    mortar: `<path d="M-12 -7c0-6 5-9 12-9s12 3 12 9z" fill="#1c1c22"/><path d="M-19 -17l19-6 19 6-19 6z" fill="#26262e"/><path d="M12 -15v10" stroke="#d7a43e" stroke-width="1.2"/><circle cx="12" cy="-4" r="1.6" fill="#d7a43e"/>`,
  }[o.hat];
  if (hat) g.push(hat);
  if (o.extra?.includes('clover')) g.push(`<g fill="#5ab85a" transform="translate(8 -16)"><circle cx="-1.6" cy="0" r="1.8"/><circle cx="1.6" cy="0" r="1.8"/><circle cx="0" cy="-1.6" r="1.8"/><circle cx="0" cy="1.6" r="1.8"/></g>`);
  if (o.extra?.includes('gem')) g.push(`<path d="M0 -15l2.5 3-2.5 3-2.5-3z" fill="#3fbf8f" stroke="#1a5a40" stroke-width=".7"/>`);
  return `<g transform="${T(0, 0)}">${g.join('')}</g>`;
}

export function portraitSVG(id) {
  const o = P[id] || P.al, many = o.many || 1;
  const coat = o.coat === 'stripe' ? 'url(#stripe)' : o.coat;
  const parts = [];
  const bust = (cx, k) => {
    const b = [`<path d="M${cx - 24 * k} 72c${2 * k}-${15 * k} ${12 * k}-${20 * k} ${24 * k}-${20 * k}s${22 * k} ${5 * k} ${24 * k} ${20 * k}z" fill="${coat}"/>`,
      `<rect x="${cx - 4 * k}" y="${46 * k + (1 - k) * 60}" width="${8 * k}" height="${8 * k}" fill="${o.skin}"/>`];
    const e = o.extra || [];
    const y0 = 72 - 20 * k;
    if (e.includes('bowtie')) b.push(`<path d="M${cx} ${y0 + 3 * k}l-${6 * k}-${3 * k}v${6 * k}zM${cx} ${y0 + 3 * k}l${6 * k}-${3 * k}v${6 * k}z" fill="#a52a2a"/>`);
    if (e.includes('tie')) b.push(`<path d="M${cx} ${y0}l-${2.5 * k} ${4 * k} ${2.5 * k} ${14 * k} ${2.5 * k}-${14 * k}z" fill="#b3242a"/>`);
    if (e.includes('stringtie')) b.push(`<path d="M${cx - 3 * k} ${y0 + 2 * k}l${3 * k} ${2 * k} ${3 * k}-${2 * k}M${cx} ${y0 + 4 * k}v${12 * k}" stroke="#d7a43e" stroke-width="${1.2 * k}" fill="none"/>`);
    if (e.includes('pearls')) b.push(`<path d="M${cx - 8 * k} ${y0 - 1 * k}q${8 * k} ${8 * k} ${16 * k} 0" stroke="#f4efe2" stroke-width="${2.4 * k}" stroke-dasharray="${.1 * k} ${2.6 * k}" stroke-linecap="round" fill="none"/>`);
    if (e.includes('sash')) b.push(`<path d="M${cx - 16 * k} ${y0 + 2 * k}l${28 * k} ${18 * k}h${6 * k}l-${28 * k}-${18 * k}z" fill="#b3242a"/>`);
    if (e.includes('suspenders')) b.push(`<path d="M${cx - 8 * k} ${y0}v${20 * k}M${cx + 8 * k} ${y0}v${20 * k}" stroke="#7a1d1d" stroke-width="${2.4 * k}"/>`);
    if (e.includes('neck')) b.push(`<path d="M${cx - 9 * k} ${y0 - 4 * k}h${18 * k}v${6 * k}h-${18 * k}z" fill="${o.skin}"/>`);
    if (e.includes('sleeve')) b.push(`<path d="M${cx - 20 * k} ${y0 + 10 * k}h${8 * k}" stroke="#2a2a2a" stroke-width="${3 * k}"/>`);
    if (e.includes('hand')) b.push(`<g fill="${o.skin}" stroke="#5a3a28" stroke-width=".7"><rect x="${cx + 9}" y="56" width="11" height="9" rx="3"/>${[0, 1, 2, 3].map(i => `<rect x="${cx + 9.5 + i * 2.6}" y="48" width="2.3" height="9" rx="1.1"/>`).join('')}</g>`);
    return b.join('');
  };
  if (many === 1) parts.push(bust(30, 1), head(o, 30, 30, 1));
  else if (many === 2) parts.push(bust(18, .78), bust(42, .78), head(o, 18, 38, .78), head({ ...o, hairC: '#e9e2cf' }, 42, 38, .78));
  else parts.push(bust(12, .6), bust(48, .6), bust(30, .66), head(o, 12, 44, .6), head(o, 48, 44, .6), head({ ...o, hair: 'curly' }, 30, 40, .66));
  return `<svg class="face" viewBox="0 0 60 72" aria-hidden="true"><rect width="60" height="72" fill="${o.bg}"/><circle cx="30" cy="34" r="27" fill="#fff" opacity=".08"/>${parts.join('')}</svg>`;
}
export const portraitDefs = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <pattern id="stripe" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#2a2a34"/><rect width=".8" height="4" fill="#8a8aa0"/></pattern>
  <pattern id="mesh" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 0l3 3M3 0L0 3" stroke="#000" stroke-width=".5"/></pattern>
</defs></svg>`;

// ---- the bar's goods: a little picture for each
export function goodIcon(kind, id) {
  if (kind === 'tip') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="5" width="26" height="31" fill="#efe6cf" stroke="#1d1a17" stroke-width="1.4" transform="rotate(-4 20 20)"/><path d="M11 12h18M11 17h18M11 22h12M11 27h15" stroke="#1d1a17" stroke-width="1.4" transform="rotate(-4 20 20)"/><circle cx="27" cy="27" r="6" fill="none" stroke="#c0392b" stroke-width="2" transform="rotate(-4 20 20)"/></svg>`;
  if (kind === 'felt') {
    const inner = {
      hot: '<circle cx="20" cy="20" r="11" fill="none" stroke="#e2552e" stroke-width="3"/><text x="20" y="24.5" text-anchor="middle" font-size="11" font-family="Alfa Slab One" fill="#e2552e">×2</text>',
      lucky: '<g fill="#7bc46a"><circle cx="16" cy="16" r="5.5"/><circle cx="24" cy="16" r="5.5"/><circle cx="16" cy="24" r="5.5"/><circle cx="24" cy="24" r="5.5"/></g><path d="M20 24q3 6 7 8" stroke="#3f7a3a" stroke-width="2" fill="none"/>',
      gold: '<rect x="10" y="10" width="20" height="20" fill="#d9b04e" stroke="#8a6a1e"/><text x="20" y="25" text-anchor="middle" font-size="13" font-family="Alfa Slab One" fill="#5a4210">$</text>',
      keeper: '<path d="M15 9v18a5 5 0 0 0 10 0V12a3 3 0 0 0-6 0v14" fill="none" stroke="#c9c2b0" stroke-width="2.4" stroke-linecap="round"/>',
      hole: '<ellipse cx="20" cy="21" rx="12" ry="9" fill="#050605"/><ellipse cx="20" cy="19" rx="12" ry="8" fill="none" stroke="#3a6a4c" stroke-width="1.5"/>',
    }[id];
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" rx="4" fill="#1d5a3c"/>${inner}</svg>`;
  }
  const t = {
    wild: '<path d="M14 12h12l2 6v14a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V18z" fill="#2b2b44"/><rect x="15" y="6" width="10" height="6" fill="#5a4630"/>' + [0, 1, 2, 3].map((s, i) => `<use href="#s${s}" x="${13 + (i % 2) * 7}" y="${19 + (i >> 1) * 7}" width="7" height="7" fill="${s === 1 || s === 2 ? '#e05a5a' : '#ece4d0'}"/>`).join(''),
    chalk: '<path d="M10 24l12-12 8 8-12 12z" fill="#4f86d9"/><path d="M10 24l8 8-4 2-6-6z" fill="#2f5ea8"/>',
    redpen: '<path d="M9 31l3-9 15-15 6 6-15 15z" fill="#c0392b"/><path d="M9 31l3-9 6 6z" fill="#f0d8a8"/><path d="M9 31l1.5-4.5 3 3z" fill="#1d1a17"/>',
    glass: '<path d="M12 6h16l-2 28H14z" fill="rgba(190,220,235,.55)" stroke="#e8f2f6" stroke-width="1.3"/><path d="M16 10l1 20" stroke="#fff" stroke-width="1.4" opacity=".8"/>',
    shave: '<path d="M8 22h24v6H8z" fill="#c9cdd2" stroke="#5a5e66"/><path d="M12 22l3-10h10l3 10" fill="#7a5233"/>',
    copy: '<rect x="10" y="9" width="16" height="22" rx="2" fill="#efe6cf" stroke="#1d1a17" stroke-width="1.2" transform="rotate(-8 18 20)"/><rect x="15" y="11" width="16" height="22" rx="2" fill="#2b3a66" stroke="#1d1a17" stroke-width="1.2" transform="rotate(6 23 22)"/>',
  }[id];
  if (t) return `<svg viewBox="0 0 40 40" aria-hidden="true">${t}</svg>`;
  const dye = +id.slice(3);
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 12h12l2 6v14a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V18z" fill="${isRed(dye) ? '#b3242a' : '#26262c'}"/><rect x="15" y="6" width="10" height="6" fill="#5a4630"/><use href="#s${dye}" x="14" y="19" width="12" height="12" fill="#efe6cf"/></svg>`;
}

// Felt work, printed on the board's squares.
export function feltHTML(id) {
  if (!id) return '';
  if (id === 'hole') return '<span class="paint hole" aria-hidden="true"></span>';
  return `<span class="paint ${id}" aria-hidden="true">${{ hot: '<b>×2</b>', lucky: '<b>+6</b>', gold: '<b>$</b>', keeper: '<b>KEEP</b>' }[id]}</span>`;
}
