// Numbers, masses, money and dates the way the page writes them.
const WORDS = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion',
  'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion'];

export function num(n, small = 0) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '−' + num(-n, small);
  if (n < 10 && small) return n.toFixed(small).replace(/\.0+$/, '');
  if (n < 1e6) return Math.floor(n).toLocaleString('en-GB');
  const e = Math.floor(Math.log10(n) / 3);
  if (e < WORDS.length) {
    const v = n / 10 ** (3 * e);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + ' ' + WORDS[e];
  }
  const [m, x] = n.toExponential(2).split('e+');
  return `${m} × 10${sup(x)}`;
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = s => [...s].map(c => SUP[+c]).join('');

// a rate: one decimal while it's small
export const rate = n => num(n, n < 10 ? 1 : 0);

export function money(n) {
  if (n < 1000) return '£' + n.toFixed(2);
  return '£' + num(n);
}

const EARTH = 5.97e27, SUN = 1.989e33, GALAXY = 3e45;
export function mass(g) {
  if (g < 1000) return `${Math.floor(g)} g`;
  if (g < 1e6) return `${(g / 1000).toFixed(g < 1e4 ? 2 : 1)} kg`;
  if (g < 0.01 * EARTH) { const t = g / 1e6; return `${t < 10 ? t.toFixed(2) : num(t)} tonne${t >= 1 && t < 2 ? '' : 's'}`; }
  if (g < 0.01 * SUN) return `${num(g / EARTH, 2)} Earths`;
  if (g < 0.001 * GALAXY) return `${num(g / SUN, 2)} Suns`;
  return `${num(g / GALAXY, 2)} galaxies`;
}

export function dur(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'}`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60), r = m % 60;
  return `${h} hour${h === 1 ? '' : 's'}${r ? ` ${r} min` : ''}`;
}
export const clock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// The date in the world, from in-world minutes since 07:00 on Monday 2 March.
const START = Date.UTC(2026, 2, 2, 7, 0);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function when(cal, phase, beyondFrom = 0) {
  if (phase >= 3) {
    const years = (cal - beyondFrom) / 525960;
    return years < 1e6 ? `${num(years)} years out` : `${num(years)} years out`;
  }
  const d = new Date(START + cal * 60000);
  const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
  if (phase === 0) return `${DAYS[d.getUTCDay()]} ${hh}:${mm}`;
  if (phase === 1) return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export const hourOf = cal => ((cal / 60 + 7) % 24 + 24) % 24;

export const cost = (c) => [c.a && `${num(c.a)} admiration`, c.m && money(c.m), c.b && `${num(c.b)} bubbles`].filter(Boolean).join(' · ');
