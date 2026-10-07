// Scales: the harvest, smallest to largest. Two of a kind that touch become one of the next. Every piece is a circle
// to the physics; `roll` is how hard it is to set rolling (about the tangent of the slope it starts to roll on), so a
// crab apple rolls off a plank you can barely see is tilted and a squash sits tight. No DOM, so Node can load it.

export const PRODUCE = [
  { key: 'crab', name: 'crab apple', r: 11, roll: 0.06, mu: 0.8 },
  { key: 'damson', name: 'damson', r: 14, roll: 0.065, mu: 0.8 },
  { key: 'apple', name: 'golden apple', r: 18.5, roll: 0.07, mu: 0.8 },
  { key: 'turnip', name: 'turnip', r: 23, roll: 0.12, mu: 0.85 },
  { key: 'acorn', name: 'acorn squash', r: 28, roll: 0.2, mu: 0.85 },
  { key: 'cabbage', name: 'savoy cabbage', r: 34, roll: 0.34, mu: 0.9 },
  { key: 'prince', name: 'crown prince', r: 41, roll: 0.3, mu: 0.85 },
  { key: 'turban', name: "turk's turban", r: 49, roll: 0.3, mu: 0.85 },
  { key: 'pumpkin', name: 'pumpkin', r: 58, roll: 0.3, mu: 0.85 },
  { key: 'giant', name: 'prize pumpkin', r: 70, roll: 0.38, mu: 0.85 },
];
export const TOP = PRODUCE.length - 1;
// what the scale's pan can be loaded with: the five smallest, the small ones more often
export const DROP_WEIGHTS = [0.27, 0.25, 0.21, 0.15, 0.12];
// points for making each size (a damson is 1, the prize pumpkin 45), and for two prize pumpkins meeting
export const POINTS = PRODUCE.map((_, i) => i * (i + 1) / 2);
export const RIBBON = 100;
export const an = name => (/^[aeiou]/.test(name) ? 'an ' : 'a ') + name;
