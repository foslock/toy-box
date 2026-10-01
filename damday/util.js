// Small shared helpers.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// The loop's clock: it starts at 7:56:00 and the water has finished its work at 8:00:00.
export const LOOP = 240, BREAK = 225;
export function clockText(t) { const s = Math.floor(clamp(t, 0, LOOP)); const m = 56 + Math.floor(s / 60); return `${m >= 60 ? 8 : 7}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
export function stamp(t) { const s = Math.floor(t); const m = 56 + Math.floor(s / 60); return `${m >= 60 ? 8 : 7}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
