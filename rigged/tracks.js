// Rigged Racer: the four tracks. Each is a loop of control points (travelling in the order given, x to the right and
// z toward the bottom of the screen; the start line is at the first point), its lanes as sections along the loop
// ([where, as a fraction of the loop, how many, and optionally the shift of their middle off the centre line]), any
// shortcut ([from and to on the loop, which side it leaves from, points between, lanes, and the gate that shuts it]),
// the track's traps, and the rows of crates it puts out itself.
export const TRACKS = {
  dust: {
    name: 'Dustbowl Speedway', theme: 'dust',
    pts: [[-4, 13.6], [10, 13.4], [21, 10], [26, 1], [23, -8], [14, -11.5], [5, -7.5], [-4, -9.5], [-13, -13], [-22, -11], [-27, -2], [-24, 8], [-15, 13]],
    lanes: [[0, 3]],
    fixtures: [{ id: 'worm', kind: 'worm', at: .43, len: 2.5 }],
  },
  scrap: {
    name: 'Scrapyard Gulch', theme: 'scrap',
    pts: [[-8, 16], [8, 16], [18, 14], [24, 7], [32, 4], [38, -4], [35, -13], [26, -15], [18, -12], [10, -16], [0, -21], [-12, -20], [-22, -15], [-26, -5], [-24, 6], [-18, 13]],
    lanes: [[0, 3], [.06, 4, .5], [.13, 3], [.6, 2], [.68, 3]],
    branches: [{ from: .16, to: .5, side: -1, pts: [[21, 5], [21, -5]], lanes: [[0, 1]], gate: 'gate' }],
    fixtures: [{ id: 'magnet', kind: 'magnet', at: .3, len: 2.5 }],
  },
  canyon: {
    name: 'Rattlesnake Canyon', theme: 'canyon',
    pts: [[-6, 17], [10, 17], [22, 14], [28, 5], [26, -5], [18, -9], [16, -17], [6, -23], [-6, -21], [-14, -14], [-22, -18], [-29, -10], [-28, 2], [-24, 10], [-16, 16]],
    lanes: [[0, 3], [.16, 2], [.24, 3], [.47, 1], [.56, 3], [.78, 2], [.86, 3]],
    bridge: [.47, .56], chasm: [-5, 22],
    fixtures: [{ id: 'boulder', kind: 'boulder', at: .35, len: 2.5 }],
  },
  refinery: {
    name: 'Refinery Row', theme: 'refinery',
    pts: [[-10, 16], [8, 16], [20, 14], [27, 6], [26, -4], [18, -9], [8, -8], [-2, -12], [-4, -20], [-14, -24], [-25, -19], [-29, -8], [-25, 4], [-21, 12]],
    lanes: [[0, 5], [.12, 3], [.3, 2], [.4, 3], [.55, 4, .5], [.68, 3], [.9, 5]],
    branches: [{ from: .16, to: .4, side: -1, pts: [[19, 9], [20, -1]], lanes: [[0, 1]], gate: 'gate' }],
    fixtures: [{ id: 'flare', kind: 'flare', at: .62, len: 3 }],
    crates: [{ at: .78 }],
  },
};
export const TRACK_IDS = Object.keys(TRACKS);
