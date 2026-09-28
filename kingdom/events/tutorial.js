// Kingdom: the very first choice a new player makes, with the walkthrough pointing at each part of it. Both ways end
// well, since nobody should die before they've learned what the numbers mean. It is never drawn at random.
export default [
  {
    id: 't_signpost', tier: 1,
    title: 'The Crossroads',
    text: 'An old signpost leans where the roads meet. One arm points into the Greenwood, where the hunting is good and the outlaws are better. The other points down the King’s Road, to the mill at Mossford, where they are hiring.',
    left: { label: 'Take the Greenwood path', tile: 'forest', out: [
      { w: 2, text: 'You set a snare at dusk and wake to two fat rabbits, and no outlaws at all. Today.', food: 3 },
      { w: 1, text: 'A poacher shares his fire and his stew, and shows you the quiet way through the trees.', food: 2, renown: 1 },
    ] },
    right: { label: 'Walk the King’s Road', tile: 'mill', out: [
      { w: 2, text: 'The miller pays you a day’s wage to haul sacks, and throws in a loaf still warm from the oven.', gold: 8, food: 1 },
      { w: 1, text: 'You mend the miller’s sails, and she pays you in coin and gossip: the old king is worse, they say.', gold: 10 },
    ] },
  },
];
