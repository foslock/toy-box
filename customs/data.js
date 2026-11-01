// Customs of the Dead: names, words, regulations, memos and endings.

export const FIRST = ['Amparo', 'Benito', 'Carmela', 'Dolores', 'Efrain', 'Esperanza', 'Fausto', 'Graciela', 'Hector',
  'Ines', 'Jacinto', 'Lucha', 'Mateo', 'Nicanor', 'Paz', 'Rafael', 'Remedios', 'Salvador', 'Teodora', 'Ulises',
  'Valentina', 'Ximena', 'Zacarias', 'Aurelio', 'Concha', 'Filomena', 'Gregorio', 'Leandro', 'Marisol', 'Rufina',
  'Silvestre', 'Tomasa', 'Bernabe', 'Celia', 'Damian', 'Eulalia', 'Gilberto', 'Herminia', 'Isidro', 'Josefa',
  'Lazaro', 'Macario', 'Natividad', 'Pascual', 'Rosalia', 'Severino', 'Trinidad', 'Victoria'];
export const LAST = ['Arriaga', 'Beltran', 'Cisneros', 'Duarte', 'Escobedo', 'Fuentes', 'Galindo', 'Huerta', 'Ibarra',
  'Jimenez', 'Lozano', 'Medina', 'Navarro', 'Pineda', 'Quiroga', 'Rosales', 'Salazar', 'Trevino', 'Urrutia', 'Vega',
  'Zamora', 'Camacho', 'Ledesma', 'Montoya', 'Sandoval', 'Barrios', 'Carrasco', 'Delgado', 'Espinoza', 'Guzman',
  'Lucero', 'Maldonado', 'Paredes', 'Rivas', 'Serrano', 'Toledo', 'Valdez', 'Villalobos'];

export const CAUSES = ['old age', 'a fever', 'a fall', "a mule's kick", 'the river', 'lightning', 'a bad oyster',
  'a broken heart', 'a duel', 'a runaway cart', 'the flu', 'a falling piano', 'a bee sting', 'too much mezcal',
  'a cold winter', 'a long illness', 'a bull', 'a well'];

export const TOWNS = ['San Lazaro', 'Rio Frio', 'Las Velas', 'Tres Cruces', 'Santa Ceniza', 'El Mirador', 'Los Pozos', 'Agua Dulce'];

export const VIRTUES = ['fed stray dogs', 'sang at weddings', 'returned a lost purse', 'nursed a neighbour',
  'planted lemon trees', 'forgave a brother', 'taught children to read', 'carried water for the widow',
  'mended nets for free', 'kept every promise', 'shared the last tortilla', 'rang the church bell'];
export const VICES = ['cheated at dominoes', 'watered the milk', 'stole a goat', 'lied to the priest',
  'kicked a dog', 'never repaid a cousin', 'moved the boundary stone', 'sold a lame horse', 'gossiped',
  'skipped Sunday mass', 'pinched from the collection', 'cursed the rain'];

export const PETNAMES = ['Bigotes', 'Canela', 'Tamal', 'Luna', 'Chispa', 'Pelusa', 'Mole', 'Garbanzo'];

export const GREET = [
  'Is this where the line ends?', 'They told me to bring papers.', 'Good evening. Or is it morning?',
  'I have been walking a long time.', 'Is it warm where I am going?', 'Do you need to see everything?',
  'My feet do not hurt any more. Is that normal?', 'I brought what they gave me.', 'Please be quick, I am nervous.',
  'Everyone is so quiet here.', 'Is there a chair? No? All right.', 'I did my best, mostly.',
  'Smells of marigolds out there.', 'Is my wife ahead of me? No? Good.', 'I left the stove on. Does it matter now?',
];

export const CONFESS = {
  name: ['The registrar never could spell.', 'That is... close enough to my name?', 'My mother wrote it that way. Sometimes.'],
  died: ['Was it that day? It all blurs.', 'I lost track of the calendar near the end.', 'The doctor was drunk. Perhaps the date too.'],
  cause: ['Well, it depends who you ask.', 'It was a bit of both, honestly.', 'My family prefers the other story.'],
  photo: ['That photo is my cousin. We share everything.', 'I looked different before. Younger.', 'The photographer was very bad.'],
  early: ['They said my time was later? Then why am I here?', 'I am early? I am never early.', 'So I can go back? Truly?'],
  cord: ['A silver thread? Then I am only dreaming?', 'I feel it pulling. Someone is calling me back.', 'Oh. The hospital. I remember.'],
  seal: ['The man at the registry said it was fine.', 'I paid extra for that seal!', 'Is the moth wrong? I liked the moth.'],
  catowner: ['She is not exactly mine. She chose me.', 'My neighbour filled that out.', 'Cats do not care for paperwork.'],
};

export const MISSING_LINE = ['I will find it, I swear.', 'I must have dropped it on the road.', 'Nobody told me about that paper.'];

export const LEAVE = {
  orchard: ['Oranges! I can smell oranges.', 'Thank you. Thank you.', 'Is that music? It is!', 'I knew it. I knew it.'],
  stair: ['Down? Are you sure?', 'I suppose I earned it.', 'It is getting warm.', 'Fine. Fine.'],
  return: ['Back to the end of the line, then.', 'I will come back with better papers.', 'Where do I even go?'],
  early: ['Back? To the living? Oh!', 'I can see the sun again!'],
};

export const DEST = {
  orchard: { name: 'ORCHARD', sub: 'up the hill' },
  stair: { name: 'STAIR', sub: 'down below' },
  return: { name: 'RETURN', sub: 'send back' },
};

// Regulations. Each one is added on its day and stays in the book.
export const RULES = [
  { id: 'docs', day: 1, text: 'Every soul shows a SOUL CARD, a DEATH CERTIFICATE and a RECORD OF DEEDS. A paper missing: RETURN.' },
  { id: 'agree', day: 1, text: 'Names and dates of death must agree on every paper. Any difference: RETURN.' },
  { id: 'deeds', day: 1, text: 'Count the tallies on the RECORD OF DEEDS. More virtues than vices: ORCHARD. Otherwise: STAIR.' },
  { id: 'photo', day: 2, text: 'The photo on the SOUL CARD must match the face at the window, and the causes of death must agree. If not: RETURN.' },
  { id: 'summons', day: 3, text: 'Every soul needs a SUMMONS. Died before the summons date: RETURN. They are early, and still have living to do.' },
  { id: 'mercy', day: 4, text: 'MERCY AMENDMENT. Equal virtues and vices: ORCHARD.' },
  { id: 'cats', day: 5, text: 'A cat at the window needs a CAT FORM naming its owner. No form, or the wrong owner: RETURN. Dogs pass freely.' },
  { id: 'cord', day: 6, text: 'Ghosts of the living may not pass. A silver cord rising from the head: RETURN.' },
  { id: 'seal', day: 7, text: "Death certificates must carry TODAY'S SEAL, shown below. Any other seal: RETURN." },
];

// Souls per day (story souls included), how long the shift runs (seconds; 0 = no clock), and which faults can appear.
export const DAYS = [
  null,
  { count: 5, time: 0, faults: ['name', 'died', 'missing'] },
  { count: 5, time: 300, faults: ['name', 'died', 'missing', 'photo', 'cause'], fresh: ['photo', 'cause'] },
  { count: 6, time: 330, faults: ['name', 'died', 'missing', 'photo', 'cause', 'early'], fresh: ['early'] },
  { count: 6, time: 330, faults: ['name', 'died', 'missing', 'photo', 'cause', 'early'] },
  { count: 6, time: 340, faults: ['name', 'died', 'missing', 'photo', 'cause', 'early', 'nocatform', 'catowner'], fresh: ['nocatform', 'catowner'] },
  { count: 7, time: 360, faults: ['name', 'died', 'missing', 'photo', 'cause', 'early', 'nocatform', 'catowner', 'cord'], fresh: ['cord'] },
  { count: 7, time: 360, faults: ['name', 'died', 'missing', 'photo', 'cause', 'early', 'nocatform', 'catowner', 'cord', 'seal'], fresh: ['seal'] },
  { count: 7, time: 360, faults: ['name', 'died', 'missing', 'photo', 'cause', 'early', 'nocatform', 'catowner', 'cord', 'seal'] },
  { count: 7, time: 360, faults: ['name', 'died', 'missing', 'photo', 'cause', 'early', 'nocatform', 'catowner', 'cord', 'seal'] },
  { count: 8, time: 380, faults: ['name', 'died', 'missing', 'photo', 'cause', 'early', 'nocatform', 'catowner', 'cord', 'seal'] },
];

export const WAGE = 5, PENALTY = 5;

// Supervisor Ossa's memo each morning.
export const MEMOS = [
  null,
  'Welcome to Booth 4. Your predecessor went down the Stair for sloppy work. Check every paper. Count every tally.',
  'Photographs are now checked against faces. People lie with their papers more than with their faces.',
  'The Office of Hours complains of early arrivals. Summons are now required. Check the dates.',
  'The Board has passed a Mercy Amendment. I voted against it.',
  'Cats now need their own form. Do not ask me why. The Board loves dogs, so dogs pass freely.',
  'The living keep wandering in while they dream. Look above the head for the silver cord.',
  'Registrar seals now change every day. Check the book each morning.',
  'A quiet week upstairs. Keep it quiet.',
  'My dear Mercedes passes through your booth today. She belongs in the ORCHARD, whatever her papers say. See to it, and you will be thanked.',
  'Inspector Huesos of the Board is auditing Booth 4 today. Answer his questions. Briefly.',
];

export const GALLO_NOTE = 'Clerk. My cousins wear a RED MARIGOLD in the hat. Send them to the ORCHARD, whatever the tallies say. Ten coins each, left under your stamp pad. Nobody upstairs will mind. I promise. -- El Gallo';

export const FAMILY = [
  { id: 'tere', name: 'Tere', who: 'your wife' },
  { id: 'beto', name: 'Beto', who: 'your son' },
  { id: 'cuca', name: 'Abuela Cuca', who: 'your grandmother' },
];

export const COSTS = { rent: 10, food: 6, heat: 4, medicine: 8, candle: 2 };

export const ENDINGS = {
  promoted: {
    title: 'THE LANTERN DESK',
    text: 'You tell Huesos about the red marigolds and the envelopes from upstairs. Ossa goes down his own Stair. You get his desk, with a window that faces the Orchard and a lamp that never needs oil.',
  },
  confessed: {
    title: 'THE BOTTOM BOOTH',
    text: 'You tell Huesos everything, including your part in it. Ossa goes down the Stair, and so do you: to clerk at the bottom booth, where the papers are always slightly on fire. It is warm, at least.',
  },
  ossa: {
    title: "OSSA'S CLERK",
    text: 'Huesos leaves with nothing. Ossa sends an envelope every week, and the red marigolds keep coming, and you keep stamping. Somewhere along the way you stopped looking at the faces.',
  },
  same: {
    title: 'BOOTH 4, FOREVER',
    text: 'You say nothing, and you had nothing to say. Huesos files his report and nothing changes. Tomorrow there will be another queue, and you will count the tallies.',
  },
};
