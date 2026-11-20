// The town's script. Every glyph is drawn on a 10×10 grid with round brush strokes.
// Families share marks: people have a head ring, verbs sit on a little ledge, counts stand on a base line.

const VERB = 'M1.4 7.6V9.1H8.6';           // the ledge every verb sits on
const head = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const GLYPHS = {
  // people
  person: { word: 'person', d: [head(5, 2.3, 1.5), 'M5 4.3V8.8', 'M3.2 8.8H6.8'] },
  child: { word: 'child', d: [head(5, 4.5, 1.1), 'M5 6V8.8', 'M3.8 8.8H6.2', 'M5 1.2V2.2'] },
  guard: { word: 'guard', d: [head(3.6, 2.4, 1.5), 'M3.6 4.4V8.8', 'M2 8.8H5.2', 'M7.8 1V9.2', 'M6.7 2.7L7.8 1L8.9 2.7'] },
  baker: { word: 'baker', d: [head(3.4, 2.4, 1.5), 'M3.4 4.4V8.8', 'M1.8 8.8H5', 'M5.9 7.4Q5.9 4.2 7.6 4.2Q9.3 4.2 9.3 7.4Z'] },
  priest: { word: 'priest', d: [head(5, 3.2, 1.4), 'M5 5.1V8.8', 'M3.2 8.8H6.8', 'M2.1 2.4Q5 -0.4 7.9 2.4', 'M5 6.4L2.7 4.9', 'M5 6.4L7.3 4.9'] },
  I: { word: 'I, me', d: ['M5 4.2V9', 'M5 6.3Q2.2 6.3 2.9 3.9'], dots: [[5, 2.1, 1.1]] },
  you: { word: 'you', d: ['M2.6 4.2V9', 'M2.6 6.4H8.6', 'M6.8 4.7L8.6 6.4L6.8 8.1'], dots: [[2.6, 2.1, 1.1]] },
  // things
  bread: { word: 'bread', d: ['M1.4 7.2Q1.4 2.6 5 2.6Q8.6 2.6 8.6 7.2Z', 'M1 8.9H9', 'M3.8 4.3L4.5 5.9', 'M5.8 4.3L6.5 5.9'] },
  fish: { word: 'fish', d: ['M1.2 5Q4.6 1.4 7.6 5Q4.6 8.6 1.2 5Z', 'M7.6 5L9.3 3.3V6.7Z'], dots: [[3.5, 4.6, 0.55]] },
  water: { word: 'water', d: ['M5 1.1C4 2.9 2.1 5 2.1 6.6A2.9 2.9 0 0 0 7.9 6.6C7.9 5 6 2.9 5 1.1Z', 'M3.9 6.9Q4.3 7.9 5.4 7.9'] },
  coin: { word: 'coin', d: [head(5, 5, 3.7), 'M4 4H6V6H4Z'] },
  sun: { word: 'sun', d: [head(5, 5, 2.1), 'M5 .7V1.9', 'M5 8.1V9.3', 'M.7 5H1.9', 'M8.1 5H9.3', 'M2 2L2.8 2.8', 'M8 2L7.2 2.8', 'M2 8L2.8 7.2', 'M8 8L7.2 7.2'] },
  house: { word: 'house', d: ['M1.6 5L5 1.6L8.4 5V9H1.6Z', 'M4.2 9V6.5H5.8V9'] },
  temple: { word: 'temple', d: ['M1 3.4L5 1L9 3.4Z', 'M2.6 4.5V7.9', 'M5 4.5V7.9', 'M7.4 4.5V7.9', 'M1 9H9'] },
  gate: { word: 'gate', d: ['M2 9.1V4.6A3 3 0 0 1 8 4.6V9.1', 'M2 6.6H8', 'M5 3.2V9.1'] },
  sea: { word: 'sea', d: ['M1 2.2H9', 'M1 5.2Q2.3 4 3.6 5.2T6.2 5.2T8.9 5.2', 'M1 8Q2.3 6.8 3.6 8T6.2 8T8.9 8'] },
  // doing
  give: { word: 'give', d: ['M1.6 6Q5 1 8.4 6', 'M6.4 5.9L8.4 6L8.6 4', VERB] },
  want: { word: 'want', d: ['M2.4 6.6Q2.4 2.6 6.4 2.6', VERB], dots: [[8, 2.6, 0.95]] },
  eat: { word: 'eat', d: ['M6.9 2.1A2.8 2.8 0 1 0 6.9 6.1', VERB], dots: [[8.4, 4.1, 0.85]] },
  go: { word: 'go', d: ['M2 1.8L4.5 4.2L2 6.6', 'M5.3 1.8L7.8 4.2L5.3 6.6', VERB] },
  open: { word: 'open', d: ['M3.9 1.4L2.3 6.4', 'M6.1 1.4L7.7 6.4', 'M3.9 1.4H6.1', VERB] },
  // small words
  no: { word: 'no, not', d: [head(5, 5, 3.6), 'M2.5 7.5L7.5 2.5'] },
  q: { word: '? (asking)', d: ['M2.8 3.4Q4 .9 6.2 1.7Q8.3 2.6 7.2 4.6Q6.4 5.8 5 6V7.3'], dots: [[5, 9, 0.75]] },
  many: { word: 'many', d: [], dots: [[2.9, 3.4, 1.05], [7.1, 3.4, 1.05], [5, 7, 1.05]] },
  good: { word: 'good', d: ['M1.6 4.2Q5 10 8.4 4.2', 'M3.3 1.6L5 3L6.7 1.6'] },
  one: { word: 'one', d: ['M1.4 8.9H8.6', 'M5 2.2V8.9'] },
  two: { word: 'two', d: ['M1.4 8.9H8.6', 'M3.6 2.2V8.9', 'M6.4 2.2V8.9'] },
  three: { word: 'three', d: ['M1.4 8.9H8.6', 'M2.6 2.2V8.9', 'M5 2.2V8.9', 'M7.4 2.2V8.9'] },
};

export const GLYPH_IDS = Object.keys(GLYPHS);

// sketchbook pages: four glyphs and the drawing that settles each
export const PAGES = [
  { id: 'count', title: 'Counting', glyphs: ['one', 'two', 'three', 'many'] },
  { id: 'folk', title: 'Townsfolk', glyphs: ['person', 'child', 'guard', 'baker'] },
  { id: 'goods', title: 'Market', glyphs: ['bread', 'fish', 'water', 'coin'] },
  { id: 'places', title: 'The town', glyphs: ['house', 'temple', 'gate', 'sea'] },
  { id: 'doing', title: 'Doing', glyphs: ['give', 'eat', 'go', 'open'] },
  { id: 'talk', title: 'Talking', glyphs: ['I', 'you', 'want', 'no'] },
  { id: 'bless', title: 'Blessings', glyphs: ['sun', 'good', 'priest', 'q'] },
];
export const PAGE_OF = {};
for (const p of PAGES) for (const g of p.glyphs) PAGE_OF[g] = p.id;

// an inline <svg> sheet of <symbol>s, so every glyph on the page is a cheap <use>
export function symbolSheet() {
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>';
  for (const [id, g] of Object.entries(GLYPHS)) {
    s += `<symbol id="g-${id}" viewBox="-.6 -.6 11.2 11.2"><g fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">`;
    for (const d of g.d) s += `<path d="${d}"/>`;
    s += '</g>';
    for (const [x, y, r] of g.dots || []) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/>`;
    s += '</symbol>';
  }
  return s + '</defs></svg>';
}
