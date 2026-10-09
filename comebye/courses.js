// The five trials of the season. Everything is in metres, x to the right and y down the field:
// the sheep are let out at the top (the lift), you stand at the post near the bottom.
//
// gate:  c = centre, d = the way the sheep should go through, w = gap between the posts
// pen:   x0..x1, y0..y1, with the gap in the top wall from gx0 to gx1 and the gate hinged at gx1
// ring:  the shedding ring, c and r

export const COURSES = [
  {
    id: 'lesson', name: 'The Lesson', place: 'Low Meadow', time: 300,
    note: 'Five quiet ewes and a short fetch. Tam walks you through it.',
    w: 52, h: 88, seed: 11, sky: 'evening',
    flock: [{ n: 5, kind: 'ewe' }],
    lift: [26, 14], post: [26, 75], dog: [23.5, 77],
    phases: ['outrun', 'fetch', 'pen'],
    gates: { fetch: { c: [26, 42], d: [0, 1], w: 8 } },
    pen: { x0: 33, x1: 41, y0: 70, y1: 75, gx0: 36.4, gx1: 41 },
    trees: [[6, 6, 4.2], [46, 30, 3.4], [7, 60, 3.6], [47, 81, 3]],
    rocks: [[40, 18, 1.1], [12, 36, 0.8]],
    tutorial: true,
  },
  {
    id: 'meadow', name: 'The Novice', place: 'Low Meadow', time: 360,
    note: 'Six ewes. After the fetch, drive them away and back across the field before the pen.',
    w: 60, h: 100, seed: 23, sky: 'morning',
    flock: [{ n: 6, kind: 'ewe' }],
    lift: [30, 14], post: [30, 84], dog: [27.5, 86],
    phases: ['outrun', 'fetch', 'drive', 'pen'],
    gates: {
      fetch: { c: [30, 46], d: [0, 1], w: 8 },
      drive: [{ c: [15, 60], d: [-0.45, -0.89], w: 8 }, { c: [46, 56], d: [1, 0], w: 8 }],
    },
    pen: { x0: 38, x1: 46, y0: 79, y1: 84, gx0: 41.4, gx1: 46 },
    trees: [[5, 8, 4], [55, 22, 3.6], [6, 44, 3], [54, 94, 3.6], [8, 92, 3.2]],
    rocks: [[22, 26, 1], [44, 38, 0.9]],
    notes: { drive: 'drive' },
  },
  {
    id: 'beck', name: 'Beck Field', place: 'Haverthwaite', time: 420,
    note: 'A beck runs across the field and the ewes have lambs at foot. Lambs startle easily.',
    w: 62, h: 104, seed: 37, sky: 'noon',
    flock: [{ n: 5, kind: 'ewe' }, { n: 3, kind: 'lamb' }],
    lift: [30, 13], post: [30, 90], dog: [27.5, 92],
    phases: ['outrun', 'fetch', 'drive', 'pen'],
    gates: {
      fetch: { c: [30, 52], d: [0, 1], w: 8 },
      drive: [{ c: [46, 66], d: [0.5, -0.87], w: 8 }, { c: [15, 64], d: [-1, 0], w: 8 }],
    },
    pen: { x0: 13, x1: 21, y0: 84, y1: 89, gx0: 16.4, gx1: 21 },
    stream: { pts: [[-2, 30], [10, 33], [20, 29], [28, 33], [36, 36], [46, 31], [56, 34], [64, 31]], w: 2.4, fords: [[31.5, 34.5, 4.5]] },
    trees: [[4, 26, 3.4], [19, 25, 3], [47, 26, 3.6], [58, 40, 3], [5, 98, 3.4], [57, 98, 3.2]],
    rocks: [[40, 18, 1.1], [52, 80, 1.2]],
    notes: { fetch: 'beck', outrun: 'lambs' },
  },
  {
    id: 'moor', name: 'High Moor', place: 'Shap Fell', time: 540,
    note: 'Wind off the tops, heather that slows them, an old tup who will not be hurried, and a shed.',
    w: 70, h: 110, seed: 41, sky: 'grey',
    flock: [{ n: 6, kind: 'ewe' }, { n: 1, kind: 'ram' }],
    marked: 1, stubborn: 1,
    lift: [35, 14], post: [35, 96], dog: [32.5, 98],
    phases: ['outrun', 'fetch', 'drive', 'shed', 'pen'],
    gates: {
      fetch: { c: [35, 54], d: [0, 1], w: 8 },
      drive: [{ c: [18, 66], d: [-0.6, -0.8], w: 8 }, { c: [54, 64], d: [1, 0], w: 8 }],
    },
    ring: { c: [35, 74], r: 11 },
    pen: { x0: 47, x1: 55, y0: 90, y1: 95, gx0: 50.4, gx1: 55 },
    heather: [[14, 30, 9], [56, 38, 8], [26, 46, 5], [60, 84, 7], [10, 86, 8], [45, 22, 5]],
    rocks: [[22, 18, 1.4], [50, 48, 1.2], [8, 58, 1.5], [62, 104, 1.3], [30, 32, 1]],
    trees: [[64, 8, 3]],
    wind: { d: [1, 0.15], s: 0.4 },
    notes: { outrun: 'ram', fetch: 'wind', shed: 'shed' },
  },
  {
    id: 'final', name: 'The Final', place: 'Crag End', time: 600,
    note: 'Morning mist on the big field. You will hear them before you see them. Shed two.',
    w: 72, h: 114, seed: 53, sky: 'mist',
    flock: [{ n: 8, kind: 'ewe' }],
    marked: 2, stubborn: 1,
    lift: [36, 14], post: [36, 100], dog: [33.5, 102],
    phases: ['outrun', 'fetch', 'drive', 'shed', 'pen'],
    gates: {
      fetch: { c: [36, 56], d: [0, 1], w: 8 },
      drive: [{ c: [54, 70], d: [0.6, -0.8], w: 8 }, { c: [18, 66], d: [-1, 0], w: 8 }],
    },
    ring: { c: [36, 80], r: 11 },
    pen: { x0: 18, x1: 26, y0: 94, y1: 99, gx0: 21.4, gx1: 26 },
    trees: [[6, 10, 4], [66, 30, 3.6], [5, 50, 3], [67, 108, 3.4], [8, 108, 3.6]],
    rocks: [[26, 28, 1.2], [50, 40, 1]],
    heather: [[60, 14, 6], [12, 30, 5]],
    fog: { r: 15 },
    notes: { outrun: 'fog', shed: 'shed2' },
  },
];

// Tam's notes for the trials after the lesson: shown once, the first time that thing comes up.
export const NOTES = {
  drive: 'The drive: take them away from you through the first gates, then across the field through the second. Keep Fly behind them, on the far side from where they need to go.',
  lambs: 'Lambs at foot. They bolt from a dog that comes in fast, and the ewes follow. Go wide and slow.',
  beck: 'Sheep will not wade. Bring them over at the ford, where the stones show.',
  ram: 'That big lad with the horns is the tup. He walks at his own pace and stands his ground if Fly is shy. Walk her right up to him.',
  wind: 'Wind from the west. Grazing sheep drift with it, so let Fly hold the downwind side.',
  shed: 'The shed: in the ring, split the marked ewe from the rest. Run Fly straight into the gap between them and hold her there until the judge calls it.',
  shed2: 'Shed the two marked ewes: get both of them on one side of Fly and the rest on the other, inside the ring.',
  fog: 'Mist. You will see the sheep only near Fly. Listen: they bleat, and the bleat comes from where they are.',
};
