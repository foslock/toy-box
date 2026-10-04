// The label-maker tape the site writes every title on, shared by the home page build and the share images.

// Tape colors. A toy picks one with "tape"; otherwise they rotate.
export const TAPES = { red: '#c8323c', blue: '#2a4d9b', green: '#2f7a4f', teal: '#17736f', purple: '#5b3a9a', orange: '#b8501a', black: '#1d1d22' };
const ROTATION = ['red', 'blue', 'green', 'purple', 'teal', 'orange', 'black'];
// i is the toy's place on the board, which picks its color when toy.json doesn't.
export const tapeColor = (t, i) => TAPES[t.tape] || (/^#[0-9a-f]{6}$/i.test(t.tape || '') ? t.tape : TAPES[ROTATION[i % ROTATION.length]]);

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Embossed letters never sit perfectly straight, so each gets a small, repeatable wobble.
function tapeLetters(text) {
  let h = 0;
  return [...String(text)].map(ch => {
    if (ch === ' ') return ' ';
    h = (h * 31 + ch.charCodeAt(0) + 7) % 997;
    const j = (h % 5) - 2;
    return `<span style="--j:${j}">${esc(ch)}</span>`;
  }).join('');
}
export const tape = (text, cls = '') => `<span class="tape${cls ? ' ' + cls : ''}"><span class="tape-text" aria-hidden="true">${tapeLetters(text)}</span><span class="sr">${esc(text)}</span></span>`;
