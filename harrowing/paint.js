// Painting helpers for the backdrops and the figures: noise, gradients, and the nine circles' colours.
export const TAU = Math.PI * 2;

export function rand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// smooth value noise on a grid, tileable horizontally when wrap is given
export function noise2(seed) {
  const r = rand(seed), P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
export function fbm(n, x, y, oct = 4) { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); f *= 2; a *= .5; } return s / (1 - Math.pow(.5, oct)); }

export const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
export const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
export function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
export const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
export function mixc(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

// Each circle's light: the sky, the glow from below, the rock, the rim light, the fog, and its weather.
export const CIRCLE_LOOK = [
  { name: 'limbo', sky: ['#07080e', '#1c2030', '#4a5670'], glow: '#a8c4e0', rock: '#22252f', rock2: '#3a3e4c', rim: '#cfe0f4', fog: '#56607a', light: '#9fb8d8', weather: 'ash', lava: '#8fb4d8' },
  { name: 'lust', sky: ['#0a0310', '#2c0c34', '#7a1a62'], glow: '#ff5fa8', rock: '#241020', rock2: '#3e1a36', rim: '#ff9ccc', fog: '#6a2058', light: '#ff7ab8', weather: 'wind', lava: '#ff3f8a' },
  { name: 'gluttony', sky: ['#070806', '#1c1e12', '#4a4626'], glow: '#c8b04a', rock: '#211f14', rock2: '#36321e', rim: '#e8d488', fog: '#4a4a2c', light: '#d8c070', weather: 'rain', lava: '#a89430' },
  { name: 'greed', sky: ['#0c0703', '#2e1a06', '#7a4a10'], glow: '#ffb83a', rock: '#2e1e0c', rock2: '#4a3214', rim: '#ffd88a', fog: '#6a4614', light: '#ffc45a', weather: 'gold', lava: '#ffbe3a' },
  { name: 'wrath', sky: ['#050404', '#1a0a08', '#4a1408'], glow: '#ff4a1a', rock: '#181010', rock2: '#2a1814', rim: '#ff7a4a', fog: '#3a1a12', light: '#ff6a3a', weather: 'embers', lava: '#ff3a0a' },
  { name: 'heresy', sky: ['#0a0303', '#3a0a05', '#9a2a08'], glow: '#ff7a1a', rock: '#260c08', rock2: '#3e1a10', rim: '#ffaa5a', fog: '#6a200c', light: '#ff8a3a', weather: 'embers', lava: '#ff6a10' },
  { name: 'violence', sky: ['#080101', '#3a0404', '#8a1006'], glow: '#ff3a2a', rock: '#260808', rock2: '#401010', rim: '#ff6a5a', fog: '#6a0a0a', light: '#ff5a3a', weather: 'fire', lava: '#d81010' },
  { name: 'fraud', sky: ['#020605', '#08201a', '#1a5a44'], glow: '#4affc0', rock: '#0a1814', rock2: '#142a24', rim: '#8affdc', fog: '#14463a', light: '#5affc8', weather: 'spores', lava: '#2ad8a0' },
  { name: 'treachery', sky: ['#02050a', '#0a1a2c', '#2a5070'], glow: '#9ad8ff', rock: '#1a2838', rock2: '#2c4258', rim: '#e0f6ff', fog: '#2e4a66', light: '#bfe8ff', weather: 'snow', lava: '#cfeeff' },
];
