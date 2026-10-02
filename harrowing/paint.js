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

// Each circle's light, for a shadow theatre: the sky from its top down to the glowing horizon, the glow itself,
// the haze far scenery fades into, the near-black ink of the nearest cut-outs, the rim light that catches every
// cut edge, the fog, the light paper takes on, the embers, and the weather.
export const CIRCLE_LOOK = [
  { name: 'limbo', sky: ['#0b0e16', '#2a3448', '#9aaec4'], glow: '#e4edf4', haze: '#6c7e96', ink: '#0b0e14', rim: '#e2ecf7', fog: '#8a9ab0', light: '#c8d6e6', weather: 'ash', lava: '#b8cce0' },
  { name: 'lust', sky: ['#13040f', '#420f38', '#d0508a'], glow: '#ffa6cc', haze: '#8e2c66', ink: '#13050f', rim: '#ffbad8', fog: '#a83e7a', light: '#ff9cc8', weather: 'wind', lava: '#ff5c9c' },
  { name: 'gluttony', sky: ['#0b0c07', '#2c2c15', '#9a9650'], glow: '#e6e090', haze: '#62602f', ink: '#0d0d07', rim: '#f0eaa8', fog: '#7e7c44', light: '#dcd690', weather: 'rain', lava: '#c8bc4a' },
  { name: 'greed', sky: ['#130a03', '#45290a', '#e09a30'], glow: '#ffdc8c', haze: '#94621e', ink: '#120a04', rim: '#ffe6aa', fog: '#a87a30', light: '#ffd890', weather: 'gold', lava: '#ffc44a' },
  { name: 'wrath', sky: ['#0c0404', '#360e09', '#c23a1e'], glow: '#ff8050', haze: '#741c12', ink: '#0e0505', rim: '#ff9a6c', fog: '#842a18', light: '#ff8a62', weather: 'embers', lava: '#ff4a14' },
  { name: 'heresy', sky: ['#130503', '#4c1507', '#ec6c20'], glow: '#ffb050', haze: '#8e300e', ink: '#120604', rim: '#ffc27e', fog: '#a8441a', light: '#ffaa5e', weather: 'embers', lava: '#ff7a1a' },
  { name: 'violence', sky: ['#110203', '#46070a', '#d42820'], glow: '#ff7058', haze: '#7e1012', ink: '#110304', rim: '#ff8c7a', fog: '#901a18', light: '#ff7a64', weather: 'fire', lava: '#ff3a1a' },
  { name: 'fraud', sky: ['#020807', '#0c2e27', '#3a9c80'], glow: '#9affda', haze: '#18584a', ink: '#030908', rim: '#acffe6', fog: '#247260', light: '#8ef0cc', weather: 'spores', lava: '#40e0b0' },
  { name: 'treachery', sky: ['#04080e', '#183652', '#a0d0ec'], glow: '#f0faff', haze: '#5a86a4', ink: '#070d16', rim: '#f0faff', fog: '#7ea8c4', light: '#d8eefa', weather: 'snow', lava: '#d4f0ff' },
];
