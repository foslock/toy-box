// Rigged Racer: the pictures on the page. Each driver's face, and an icon for everything that can be put down, set
// off, picked up or pressed. Plain SVG strings.
const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;
const S = 'stroke="#2a1a10" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';

export const ICONS = {
  oil: svg(`<path d="M12 3c3 4.5 5 7.4 5 10a5 5 0 0 1-10 0c0-2.6 2-5.5 5-10z" fill="#fff" ${S}/><ellipse cx="12" cy="20.5" rx="8" ry="2" fill="#fff" opacity=".55"/>`),
  spikes: svg(`<path d="M2 18h20v3H2z" fill="#fff" ${S}/><path d="M3 18l2.5-9L8 18m0 0l2.5-11L13 18m0 0l2.5-9L18 18m0 0l2-7 1.5 7" fill="#fff" ${S}/>`),
  barrel: svg(`<rect x="5" y="3" width="14" height="18" rx="3" fill="#fff" ${S}/><path d="M5 9h14M5 15h14" ${S}/>`),
  mine: svg(`<path d="M3 17c0-3.5 4-6 9-6s9 2.5 9 6z" fill="#fff" ${S}/><path d="M2 17h20v2.5H2z" fill="#fff" ${S}/><circle cx="12" cy="8" r="2.2" fill="#ff5a3d" ${S}/>`),
  boost: svg(`<path d="M5 13l7-6 7 6v3.5l-7-6-7 6zM5 20l7-6 7 6" fill="#fff" ${S}/>`),
  ramp: svg(`<path d="M2 20h20V9z" fill="#fff" ${S}/><path d="M6 8l6-4m0 0l-.5 3.5M12 4l-3.4.2" fill="none" ${S}/>`),
  crate: svg(`<rect x="3.5" y="3.5" width="17" height="17" rx="2" fill="#fff" ${S}/><path d="M9.5 10a2.6 2.6 0 1 1 3.4 2.4c-.6.2-.9.7-.9 1.3v.3" fill="none" ${S}/><circle cx="12" cy="17" r=".6" fill="#2a1a10" ${S}/>`),
  skull: svg(`<path d="M12 2.5c5 0 8 3.4 8 7.6 0 2.6-1.4 4.3-3 5.2V19h-10v-3.7c-1.6-.9-3-2.6-3-5.2C4 5.9 7 2.5 12 2.5z" fill="#fff" ${S}/><circle cx="8.8" cy="10.5" r="1.9" fill="#2a1a10"/><circle cx="15.2" cy="10.5" r="1.9" fill="#2a1a10"/><path d="M10 19v2.5M14 19v2.5" ${S}/>`),
  rocket: svg(`<path d="M3 13.5l4-1 7-7c2-2 5.5-2.5 6.5-2.5 0 1-.5 4.5-2.5 6.5l-7 7-1 4-2.5-3.5L4 16z" fill="#fff" ${S}/><circle cx="15" cy="9" r="1.6" fill="#2a1a10"/>`),
  homing: svg(`<circle cx="12" cy="12" r="8.5" fill="#fff" ${S}/><circle cx="12" cy="12" r="4" fill="#ff5a3d" ${S}/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" ${S}/>`),
  nitro: svg(`<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6z" fill="#fff" ${S}/>`),
  chrome: svg(`<path d="M12 2l2.6 6.6L21.5 9l-5.3 4.4L18 21l-6-3.8L6 21l1.8-7.6L2.5 9l6.9-.4z" fill="#fff" ${S}/>`),
  vulture: svg(`<path d="M1.5 9c4 0 6 1 8 3l2.5-2.5 2.5 2.5c2-2 4-3 8-3-2.5 2-4 4.5-5.5 6.5-1.7-1-3-1.2-5-1.2s-3.3.2-5 1.2C5.5 13.5 4 11 1.5 9z" fill="#fff" ${S}/><circle cx="12" cy="19.5" r="2.2" fill="#2a1a10"/>`),
  worm: svg(`<path d="M4 21c0-7 1.5-15 8-15s8 8 8 15" fill="none" stroke="#2a1a10" stroke-width="9" stroke-linecap="round"/><path d="M4 21c0-7 1.5-15 8-15s8 8 8 15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M8.5 7.5l1 2.2M12 6v2.4M15.5 7.5l-1 2.2" ${S}/>`),
  magnet: svg(`<path d="M5 3h4.5v9a2.5 2.5 0 0 0 5 0V3H19v9a7 7 0 0 1-14 0z" fill="#fff" ${S}/><path d="M5 7.5h4.5M14.5 7.5H19" ${S}/>`),
  boulder: svg(`<path d="M4 15c-1-5 2.5-10 8-10.5 5-.4 8.5 3 8 8-.3 4-3.5 7.5-8 7.5-4 0-7.3-1.8-8-5z" fill="#fff" ${S}/><path d="M9 10l2 2m3-4l1 1.5M8 15l2.5-.5" ${S}/>`),
  flare: svg(`<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4.5 2.5-7 1.5 1.5 2 3 2 4.5C12 9 12 5 12 2z" fill="#fff" ${S}/>`),
  gate: svg(`<path d="M4 4v17M3 21h3" ${S}/><path d="M5 8h16v4H5z" fill="#fff" ${S}/><path d="M9 8l-2 4m6-4l-2 4m6-4l-2 4m6-4l-2 4" stroke="#d23a2c" stroke-width="2"/>`),
  play: svg(`<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`),
  pause: svg(`<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor"/>`),
  rewind: svg(`<path d="M11.5 6v12L3 12zM21 6v12l-8.5-6z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`),
  restart: svg(`<path d="M4 12a8 8 0 1 0 2.4-5.7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  help: svg(`<path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7V14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="18" r="1.2" fill="currentColor"/>`),
  menu: svg(`<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`),
  sound: svg(`<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path class="x" d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),
  fit: svg(`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  skip: svg(`<path d="M4 6v12l8-6zM12 6v12l8-6z" fill="currentColor"/><path d="M21 5v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`),
  flag: svg(`<path d="M5 21V4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M5 4h14l-3 4.5 3 4.5H5z" fill="currentColor"/>`),
};
// the colour of each card
export const CARD = {
  oil: '#5a4a72', spikes: '#7d8794', barrel: '#d24a2e', mine: '#6b7a3a', boost: '#e8960e', ramp: '#b0703a', crate: '#a0662c', skull: '#7d93ad',
  worm: '#c47a3e', magnet: '#3d72b8', boulder: '#a8502e', flare: '#e0602a', gate: '#c8a020',
  rocket: '#7d8794', homing: '#d23a2c', nitro: '#e8960e', chrome: '#7d93ad', vulture: '#6b4a3a',
};

// A driver's face, in a circle of their colour.
export function face(who, color) {
  const bg = `<circle cx="32" cy="32" r="31" fill="${color}"/>`;
  const ink = 'stroke="#2a1a10" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
  const eyes = (y = 33, dx = 7) => `<circle cx="${32 - dx}" cy="${y}" r="2.8" fill="#2a1a10"/><circle cx="${32 + dx}" cy="${y}" r="2.8" fill="#2a1a10"/>`;
  const shades = (y = 31) => `<path d="M17 ${y - 3}h30v5c0 3-3 4-7 4s-6-2-8-4c-2 2-4 4-8 4s-7-1-7-4z" fill="#1a1414" ${ink}/>`;
  let f = '';
  switch (who) {
    case 'duke': f = `<path d="M14 36c0-12 8-20 18-20s18 8 18 20-8 20-18 20-18-8-18-20z" fill="#d9925e" ${ink}/><path d="M14 30c2-10 9-15 18-15s16 5 18 15c-8-3-28-3-36 0z" fill="#d23a2c" ${ink}/>${shades(34)}<path d="M23 45c4-3 14-3 18 0-3 2-6 2-9 1-3 1-6 1-9-1z" fill="#5a3418" ${ink}/>`; break;
    case 'pip': f = `<circle cx="32" cy="36" r="16" fill="#f2c49b" ${ink}/><path d="M15 32c0-10 7-16 17-16s17 6 17 16c-6-3-28-3-34 0z" fill="#7a4a22" ${ink}/><circle cx="25" cy="26" r="5" fill="#9fe0ff" ${ink}/><circle cx="39" cy="26" r="5" fill="#9fe0ff" ${ink}/>${eyes(37, 6)}<path d="M27 44c3 2 7 2 10 0" fill="none" ${ink}/><circle cx="22" cy="41" r="1.3" fill="#c46a3a"/><circle cx="42" cy="41" r="1.3" fill="#c46a3a"/>`; break;
    case 'granny': f = `<circle cx="32" cy="36" r="16" fill="#f0c8a8" ${ink}/><path d="M16 34c-2-11 6-19 16-19s18 8 16 19c-3-6-9-9-16-9s-13 3-16 9z" fill="#d8d4dc" ${ink}/><circle cx="32" cy="13" r="6" fill="#d8d4dc" ${ink}/><circle cx="25" cy="36" r="5" fill="#ffffff" fill-opacity=".5" ${ink}/><circle cx="39" cy="36" r="5" fill="#ffffff" fill-opacity=".5" ${ink}/><circle cx="25" cy="36" r="1.8" fill="#2a1a10"/><circle cx="39" cy="36" r="1.8" fill="#2a1a10"/><path d="M26 46c4 3 8 3 12 0" fill="none" ${ink}/>`; break;
    case 'mutt': f = `<path d="M15 22c-5 2-7 14-3 20 3-4 5-10 6-15zM49 22c5 2 7 14 3 20-3-4-5-10-6-15z" fill="#6a4220" ${ink}/><circle cx="32" cy="33" r="15" fill="#a8743e" ${ink}/><path d="M18 27h28v6H18z" fill="#333" ${ink}/><circle cx="25" cy="30" r="4" fill="#ffb340" ${ink}/><circle cx="39" cy="30" r="4" fill="#ffb340" ${ink}/><ellipse cx="32" cy="42" rx="8" ry="6" fill="#8a5a2c" ${ink}/><circle cx="32" cy="39" r="2.6" fill="#1a1010"/><path d="M30 47c0 5 4 5 4 0" fill="#e0607a" ${ink}/>`; break;
    case 'sprocket': f = `<path d="M32 8v8" ${ink}/><circle cx="32" cy="7" r="3.5" fill="#ff4a3d" ${ink}/><rect x="16" y="16" width="32" height="30" rx="6" fill="#9fb4c8" ${ink}/><rect x="20" y="25" width="24" height="10" rx="4" fill="#101820" ${ink}/><circle cx="27" cy="30" r="2.5" fill="#5fffd0"/><circle cx="37" cy="30" r="2.5" fill="#5fffd0"/><path d="M24 41h16" ${ink}/><rect x="20" y="46" width="24" height="8" rx="2" fill="#5d7388" ${ink}/>`; break;
    case 'rhonda': f = `<path d="M26 20l2-12 4 10 4-10 2 12z" fill="#f27a22" ${ink}/><circle cx="32" cy="36" r="16" fill="#c98a5a" ${ink}/>${shades(35)}<path d="M26 45c4 2 8 2 12-1" fill="none" ${ink}/><circle cx="17" cy="40" r="2" fill="#ffd23a" ${ink}/>`; break;
    case 'spike': f = `<path d="M18 56V30c0-9 6-15 14-15s14 6 14 15v26z" fill="#5aa846" ${ink}/><path d="M22 24l-4-2M42 24l4-2M20 36l-4 0M44 36h4M21 48h-4M43 48h4M32 16v-4" ${ink}/><circle cx="32" cy="12" r="5" fill="#ff5a9a" ${ink}/>${eyes(32, 6)}<path d="M28 41c2 1.5 6 1.5 8 0" fill="none" ${ink}/>`; break;
    case 'count': f = `<path d="M18 50l-4 8h36l-4-8z" fill="#a01a2a" ${ink}/><path d="M17 34c0-12 7-18 15-18s15 6 15 18-7 16-15 16-15-4-15-16z" fill="#e6e2ea" ${ink}/><path d="M17 32c0-11 7-17 15-17s15 6 15 17c-4-4-8-6-11-6l-4 6-4-6c-3 0-7 2-11 6z" fill="#141418" ${ink}/>${shades(37)}<path d="M28 46l1.5 3 1.5-3m2 0l1.5 3 1.5-3" fill="#fff" stroke="#2a1a10" stroke-width="1.6"/>`; break;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${bg}${f}</svg>`;
}
