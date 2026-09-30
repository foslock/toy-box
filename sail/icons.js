// Sail: the pictures on the orders (white, on the card's own colour) and the crew's faces for when they speak.

const W = 'fill="#fff" stroke="#2a1a10" stroke-width="1.6" stroke-linejoin="round"';
const L = 'fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"';
export const ICONS = {
  hoist: `<svg viewBox="0 0 32 32"><path d="M13 4v22" ${L} stroke-width="2.6"/><path d="M14 6c7 3 11 9 11 17H14z" ${W}/><path d="M7 21V9m-3.5 4L7 9l3.5 4" ${L} stroke-width="3"/><path d="M6 27h20" ${L} stroke-width="3"/></svg>`,
  strike: `<svg viewBox="0 0 32 32"><path d="M13 4v22" ${L} stroke-width="2.6"/><path d="M14 18c5 1 9 3 10 5H14z" ${W}/><path d="M7 7v12m-3.5-4L7 19l3.5-4" ${L} stroke-width="3"/><path d="M6 27h20" ${L} stroke-width="3"/></svg>`,
  steady: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="8.5" ${L} stroke-width="3"/><circle cx="16" cy="16" r="2.6" fill="#fff"/><path d="M16 3v6M16 23v6M3 16h6M23 16h6M6.8 6.8l4.2 4.2M21 21l4.2 4.2M25.2 6.8L21 11M11 21l-4.2 4.2" ${L} stroke-width="2.8"/></svg>`,
  port: `<svg viewBox="0 0 32 32"><path d="M22 27V17c0-5-3-8-8-8H8" ${L} stroke-width="3.6"/><path d="M12 3.5L6 9l6 5.5" ${L} stroke-width="3.6"/></svg>`,
  starboard: `<svg viewBox="0 0 32 32"><path d="M10 27V17c0-5 3-8 8-8h6" ${L} stroke-width="3.6"/><path d="M20 3.5L26 9l-6 5.5" ${L} stroke-width="3.6"/></svg>`,
  anchor: `<svg viewBox="0 0 32 32"><circle cx="16" cy="6.5" r="3" ${L} stroke-width="2.6"/><path d="M16 9.5V28M10 14h12" ${L} stroke-width="3"/><path d="M5.5 18c0 6 5 10 10.5 10s10.5-4 10.5-10" ${L} stroke-width="3"/><path d="M3 20l2.5-3 3 2.5M29 20l-2.5-3-3 2.5" ${L} stroke-width="2.4"/></svg>`,
  fire: `<svg viewBox="0 0 32 32"><path d="M5 20l14-9 3 5-14 9z" ${W}/><circle cx="10" cy="24" r="4.2" ${W}/><circle cx="10" cy="24" r="1.2" fill="#2a1a10"/><path d="M23.5 8.5l2.5-2.5M25 12.5l3.5-.5M21 6.5l.5-3.5" ${L} stroke-width="2.4"/></svg>`,
  grapple: `<svg viewBox="0 0 32 32"><path d="M25 4c-4 0-6 2-6 5" ${L} stroke-width="2.2" stroke-dasharray="2.5 2.5"/><circle cx="16" cy="7.5" r="3" ${L} stroke-width="2.6"/><path d="M16 10.5V25" ${L} stroke-width="3.2"/><path d="M16 25c-5 0-8.5-3-9-8.5M16 25c5 0 8.5-3 9-8.5" ${L} stroke-width="3.2"/><path d="M4.5 18.5L7 16l2.5 2.5M27.5 18.5L25 16l-2.5 2.5" ${L} stroke-width="2.6"/><path d="M16 25v3.5" ${L} stroke-width="3.2"/></svg>`,
};

// The crew, each with the orders they carry out and a face: a round head, a hat, a bit of colour.
export const CREW = {
  captain: { name: 'Captain Wren', role: 'at the helm', skin: '#f2c49b', hat: '#2d4f8a', band: '#f5c542', shirt: '#2d4f8a', hair: '#6b3d1f', hatKind: 'tricorn' },
  bosun: { name: 'Bo', role: 'the bosun', skin: '#8d5a3b', hat: '#e0524a', band: '#fff', shirt: '#f4f1e6', hair: '#2a1a10', hatKind: 'bandana' },
  anchor: { name: 'Marlo', role: 'on the windlass', skin: '#e8b48a', hat: '#2f6f7e', band: '#9fd8e0', shirt: '#2f6f7e', hair: '#c9772f', hatKind: 'beanie', beard: true },
  gunner: { name: 'Pip', role: 'the gunner', skin: '#c68b5e', hat: '#f07f2a', band: '#2a1a10', shirt: '#b8322a', hair: '#2a1a10', hatKind: 'cap' },
  hook: { name: 'Nell', role: 'with the hook', skin: '#f5d0b0', hat: '#8a5cc2', band: '#f5c542', shirt: '#8a5cc2', hair: '#e8b73c', hatKind: 'none', braid: true },
};

export function face(who) {
  const c = CREW[who];
  const hat = {
    tricorn: `<path d="M8 22c6-9 26-9 32 0-4-3-8-2-16-2S12 19 8 22z" fill="${c.hat}" stroke="#2a1a10" stroke-width="2"/><path d="M13 19c4-8 18-8 22 0" fill="${c.hat}" stroke="#2a1a10" stroke-width="2"/><path d="M14 19.5c6-2 14-2 20 0" stroke="${c.band}" stroke-width="2" fill="none"/>`,
    bandana: `<path d="M10 22c0-10 28-10 28 0z" fill="${c.hat}" stroke="#2a1a10" stroke-width="2"/><circle cx="17" cy="16" r="1.3" fill="${c.band}"/><circle cx="25" cy="14" r="1.3" fill="${c.band}"/><circle cx="31" cy="17" r="1.3" fill="${c.band}"/><path d="M37 21l6 3-5 2" fill="${c.hat}" stroke="#2a1a10" stroke-width="2"/>`,
    beanie: `<path d="M11 22c0-11 26-11 26 0z" fill="${c.hat}" stroke="#2a1a10" stroke-width="2"/><rect x="10" y="19" width="28" height="5" rx="2.5" fill="${c.band}" stroke="#2a1a10" stroke-width="2"/><circle cx="24" cy="9" r="3" fill="${c.band}" stroke="#2a1a10" stroke-width="2"/>`,
    cap: `<path d="M11 22c0-10 26-10 26 0z" fill="${c.hat}" stroke="#2a1a10" stroke-width="2"/><path d="M24 21h16c0 3-6 3-16 3z" fill="${c.hat}" stroke="#2a1a10" stroke-width="2"/>`,
    none: '',
  }[c.hatKind];
  const hair = c.braid
    ? `<path d="M11 26c0-12 26-12 26 0-4-5-9-6-13-6s-9 1-13 6z" fill="${c.hair}" stroke="#2a1a10" stroke-width="2"/><path d="M36 26c4 4 4 10 1 14" fill="none" stroke="${c.hair}" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M12 25c0-6 4-9 12-9s12 3 12 9c-3-3-7-4-12-4s-9 1-12 4z" fill="${c.hair}"/>`;
  const beard = c.beard ? `<path d="M13 30c2 9 20 9 22 0-4 3-18 3-22 0z" fill="${c.hair}" stroke="#2a1a10" stroke-width="2"/>` : '';
  return `<svg viewBox="0 0 48 48"><rect width="48" height="48" fill="#bfe6ff"/><path d="M6 48c2-8 9-11 18-11s16 3 18 11z" fill="${c.shirt}" stroke="#2a1a10" stroke-width="2"/>
    <circle cx="24" cy="27" r="12" fill="${c.skin}" stroke="#2a1a10" stroke-width="2"/>${hair}
    <ellipse cx="19.5" cy="28" rx="1.8" ry="2.4" fill="#2a1a10"/><ellipse cx="28.5" cy="28" rx="1.8" ry="2.4" fill="#2a1a10"/>
    <circle cx="16" cy="32" r="2" fill="#f28b82" opacity=".6"/><circle cx="32" cy="32" r="2" fill="#f28b82" opacity=".6"/>
    <path d="M21 33c2 2 4 2 6 0" fill="none" stroke="#2a1a10" stroke-width="1.8" stroke-linecap="round"/>${beard}${hat}</svg>`;
}
