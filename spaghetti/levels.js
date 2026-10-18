// The science fair projects. Coordinates are graph-paper squares, y up, floor at 0.
// boxes: furniture (solid). anchors: drawing pins you can glue pasta to.
// ribbons: [1st prize grams, 2nd prize grams]; any pass within budget earns 3rd.
// ref: a known good bridge, used by the checker and the demo.

const S = 'spaghetti', R = 'rigatoni', L = 'lasagne';
const m = (x1, y1, x2, y2, mat) => ({ a: [x1, y1], b: [x2, y2], mat });

export const LEVELS = [
  {
    id: 'gap', name: 'Mind the Gap', w: 14, h: 9,
    note: 'Two desks, one toy car.',
    boxes: [{ x: 0, y: 0, w: 5, h: 5, kind: 'desk' }, { x: 8, y: 0, w: 6, h: 5, kind: 'desk' }],
    anchors: [[5, 5], [8, 5]],
    spawn: [1.6, 5], finish: 10.5, fallY: 2,
    loads: ['car'], budget: 30, ribbons: [18, 24],
    ref: [m(5, 5, 8, 5, L)],
  },
  {
    id: 'half', name: 'Halfway There', w: 14, h: 9,
    note: 'Too wide for one sheet.',
    boxes: [{ x: 0, y: 0, w: 4, h: 5, kind: 'desk' }, { x: 10, y: 0, w: 4, h: 5, kind: 'desk' }],
    anchors: [[4, 5], [10, 5], [4, 3], [10, 3]],
    spawn: [1.4, 5], finish: 11.5, fallY: 2,
    loads: ['car'], budget: 60, ribbons: [51, 56],
    ref: [m(4, 5, 7, 5, L), m(7, 5, 10, 5, L), m(4, 5, 7, 4, S), m(7, 4, 10, 5, S), m(7, 4, 7, 5, R)],
  },
  {
    id: 'shelf', name: 'Strings Attached', w: 14, h: 10,
    note: 'There\'s a shelf up there.',
    boxes: [{ x: 0, y: 0, w: 3, h: 5, kind: 'desk' }, { x: 11, y: 0, w: 3, h: 5, kind: 'desk' }, { x: 4, y: 8, w: 6, h: 1, kind: 'shelf' }],
    anchors: [[3, 5], [11, 5], [5, 8], [7, 8], [9, 8]],
    spawn: [1.2, 5], finish: 12.4, fallY: 2,
    loads: ['car', 'books'], budget: 80, ribbons: [62, 70],
    ref: [m(3, 5, 5, 5, L), m(5, 5, 7, 5, L), m(7, 5, 9, 5, L), m(9, 5, 11, 5, L), m(5, 8, 5, 5, S), m(7, 8, 7, 5, S), m(9, 8, 9, 5, S)],
  },
  {
    id: 'books', name: 'Book Report', w: 16, h: 10,
    note: 'Somebody left their reading in the way.',
    boxes: [{ x: 0, y: 0, w: 3, h: 5, kind: 'desk' }, { x: 13, y: 0, w: 3, h: 5, kind: 'desk' }, { x: 7, y: 0, w: 2, h: 4, kind: 'books' }],
    anchors: [[3, 5], [13, 5], [3, 3], [13, 3], [7, 4], [9, 4]],
    spawn: [1.2, 5], finish: 14.4, fallY: 2,
    loads: ['car', 'books'], budget: 115, ribbons: [93, 102],
    ref: [m(3, 5, 5, 5, L), m(5, 5, 7, 5, L), m(7, 5, 9, 5, L), m(9, 5, 11, 5, L), m(11, 5, 13, 5, L),
      m(7, 4, 5, 5, R), m(9, 4, 11, 5, R), m(7, 4, 7, 5, R), m(9, 4, 9, 5, R)],
  },
  {
    id: 'uphill', name: 'Uphill Battle', w: 15, h: 10,
    note: 'The far desk is taller. Biscuit the hamster wants a go.',
    boxes: [{ x: 0, y: 0, w: 4, h: 4, kind: 'desk' }, { x: 11, y: 0, w: 4, h: 6, kind: 'tall' }],
    anchors: [[4, 4], [11, 6], [4, 2], [11, 4]],
    spawn: [1.4, 4], finish: 12.8, fallY: 1.5,
    loads: ['car', 'hamster'], budget: 110, ribbons: [86, 96],
    ref: [m(4, 4, 7, 4, L), m(7, 4, 9, 5, L), m(9, 5, 11, 6, L),
      m(4, 2, 6, 3, R), m(6, 3, 7, 4, R), m(4, 4, 6, 3, S), m(6, 3, 9, 3, S), m(9, 3, 11, 4, R), m(7, 4, 9, 3, S), m(9, 3, 9, 5, R)],
  },
  {
    id: 'hang', name: 'Hang Time', w: 16, h: 11,
    note: 'A long shelf, and the lunch trays are coming.',
    boxes: [{ x: 0, y: 0, w: 3, h: 4, kind: 'desk' }, { x: 13, y: 0, w: 3, h: 4, kind: 'desk' }, { x: 2, y: 9, w: 12, h: 1, kind: 'shelf' }],
    anchors: [[3, 4], [13, 4], [4, 9], [6, 9], [8, 9], [10, 9], [12, 9]],
    spawn: [1.2, 4], finish: 14.4, fallY: 1,
    loads: ['car', 'books', 'tray'], budget: 150, ribbons: [100, 120],
    ref: [m(3, 4, 4, 4, L), m(4, 4, 6, 4, L), m(6, 4, 8, 4, L), m(8, 4, 10, 4, L), m(10, 4, 12, 4, L), m(12, 4, 13, 4, L),
      m(4, 9, 4, 4, S), m(6, 9, 6, 4, S), m(8, 9, 8, 4, S), m(10, 9, 10, 4, S), m(12, 9, 12, 4, S),
      m(4, 9, 6, 4, S), m(6, 9, 8, 4, S), m(10, 9, 8, 4, S), m(12, 9, 10, 4, S)],
  },
  {
    id: 'long', name: 'Long Division', w: 18, h: 11,
    note: 'Twelve squares and nothing to lean on.',
    boxes: [{ x: 0, y: 0, w: 3, h: 6, kind: 'desk' }, { x: 15, y: 0, w: 3, h: 6, kind: 'desk' }],
    anchors: [[3, 6], [15, 6], [3, 4], [15, 4], [3, 2], [15, 2]],
    spawn: [1.2, 6], finish: 16.4, fallY: 2,
    loads: ['car', 'hamster', 'books'], budget: 260, ribbons: [180, 210],
    ref: (() => {
      const r = [];
      for (let x = 3; x < 15; x += 2) r.push(m(x, 6, x + 2, 6, L));
      for (let x = 3; x < 15; x += 2) r.push(m(x, 4, x + 2, 4, x === 7 || x === 9 ? S : R));
      for (let x = 5; x <= 13; x += 2) r.push(m(x, 4, x, 6, R));
      r.push(m(3, 6, 5, 4, S), m(5, 6, 7, 4, S), m(11, 4, 13, 6, S), m(13, 4, 15, 6, S));
      for (const cx of [8, 10]) r.push(m(cx - 1, 6, cx, 5, R), m(cx, 5, cx + 1, 4, R), m(cx - 1, 4, cx, 5, R), m(cx, 5, cx + 1, 6, R));
      return r;
    })(),
  },
  {
    id: 'bowl', name: 'Bowling Day', w: 16, h: 11,
    note: 'The head teacher has brought her bowling ball.',
    boxes: [{ x: 0, y: 0, w: 3, h: 6, kind: 'desk' }, { x: 13, y: 0, w: 3, h: 6, kind: 'desk' }, { x: 7, y: 0, w: 2, h: 2, kind: 'lunchbox' }],
    anchors: [[3, 6], [13, 6], [3, 4], [13, 4], [3, 2], [13, 2], [7, 2], [9, 2]],
    spawn: [1.2, 6], finish: 14.4, fallY: 2,
    loads: ['car', 'books', 'tray', 'bowling'], budget: 260, ribbons: [172, 200],
    ref: (() => {
      const r = [];
      for (let x = 3; x < 13; x += 2) r.push(m(x, 6, x + 2, 6, L));
      r.push(m(7, 2, 7, 4, R), m(9, 2, 9, 4, R), m(7, 4, 7, 6, R), m(9, 4, 9, 6, R), m(7, 4, 9, 4, R));
      r.push(m(3, 4, 5, 4, R), m(5, 4, 7, 4, R), m(9, 4, 11, 4, R), m(11, 4, 13, 4, R));
      r.push(m(5, 4, 5, 6, R), m(11, 4, 11, 6, R), m(3, 6, 5, 4, S), m(11, 4, 13, 6, S));
      for (const cx of [6, 10]) r.push(m(cx - 1, 6, cx, 5, R), m(cx, 5, cx + 1, 4, R), m(cx - 1, 4, cx, 5, R), m(cx, 5, cx + 1, 6, R));
      return r;
    })(),
  },
];
