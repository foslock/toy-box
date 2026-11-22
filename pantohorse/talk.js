// The tannoy: Major Pip Hargreaves, who has commentated on the Lower Bramble Show since 1971
// and is far too excited about the pantomime horse classes.
const LINES = {
  go: ['And they’re off!', 'Away they go, all four legs of them!', 'Under way! More or less!'],
  goParade: ['Strike up the band! And the horse is off down the high street.', 'Here comes the parade! Keep up with the tuba, now.'],
  goDressage: ['The dressage test. The judge is watching. Very closely.', 'A hush falls over the ring. Dressage, ladies and gentlemen.'],
  goRace: ['The Grand Panto Derby! And they’re OFF!', 'Four horses, eight fences, no dignity whatsoever. GO!'],
  trip: ['Oh, a hoof in the timber!', 'Clipped it!', 'He’s caught his toe on that!', 'Steady, steady!', 'That’s a stumble from the front end.'],
  tripBack: ['The back end’s walked straight into it. He can’t see, you know.', 'Back legs caught it!', 'The rear has found the log. With its shins.'],
  stumble: ['Too many legs going at once!', 'Feet everywhere!', 'They’re tripping over themselves!'],
  bump: ['Ooh, a headbutt from behind!', 'The back end’s gone straight into her!', 'Bit of a rear-end shunt there!'],
  stretch: ['The costume’s stretching!', 'They’re pulling apart, wait for each other!', 'I can see daylight between them!', 'Mind the seams!'],
  tear: ['RIIIIP! And that’s two horses now!', 'The costume’s gone! Oh, the humanity!', 'It’s torn clean in half! Someone fetch a needle!'],
  wipeNose: ['DOWN she goes! Nose first!', 'Oh! Straight over the top!', 'A tumble! A tremendous tumble!', 'Face-first into the turf!'],
  wipeRear: ['Over backwards! The back end’s sat down!', 'Down goes the rear!', 'The back end’s gone! He just sat down!'],
  respawn: ['Back on their feet. Well, someone’s feet.', 'Dust yourselves off and away again!', 'And they’re up! The crowd loves a trier.'],
  clear: ['Lovely jump!', 'Clean as a whistle!', 'Over it! Both ends!', 'Textbook! Well, a textbook of something.'],
  flag: ['Through the flag!', 'Past the flag, nicely done.'],
  hopOnly: ['The front’s over, but what about the back?', 'Front end clear. Now the back…'],
  splash: ['SPLASH! Straight in the duck pond!', 'Wet hooves! Wet everything!', 'Into the ditch! The ducks are furious!'],
  tuba: ['PARP! Right into the tuba!', 'Mr Fenwick and his tuba did not see that coming!', 'Not the tuba! Not again!'],
  far: ['Keep up with the band!', 'The band’s getting away from you!'],
  halt: ['And… halt! Lovely, square halt.', 'A perfect halt! The judge rings her bell.', 'Stopped dead on the letter! Bravo!'],
  missed: ['Oh, sailed straight past the marker! That’s eight seconds.', 'Past the letter! The judge is not amused.'],
  rivalDown: ['{name} is down!', 'Disaster for {name}!', 'And {name} have come a cropper!'],
  rivalHome: ['{name} cross the line!', 'Home goes {name}!'],
  finish: ['Across the line! Listen to that crowd!', 'They’ve done it! Both ends!', 'Home and dry! Well. Home.'],
  replay: ['Let’s see that again!', 'Here’s the replay. Oh dear, oh dear.', 'Action replay! Watch the back legs.'],
};

export class Tannoy {
  constructor() { this.last = {}; this.say = null; this.until = 0; this.cool = 0; this.used = {}; }
  pick(key, vars = {}) {
    const pool = LINES[key]; if (!pool) return null;
    const used = this.used[key] || (this.used[key] = []);
    let opts = pool.map((_, i) => i).filter((i) => !used.includes(i));
    if (!opts.length) { used.length = 0; opts = pool.map((_, i) => i); }
    const i = opts[Math.floor(Math.random() * opts.length)];
    used.push(i);
    return pool[i].replace('{name}', vars.name || '');
  }
  // priority: bigger news can talk over smaller news
  line(key, now, { pri = 1, vars, hold = 2.6 } = {}) {
    if (now < this.cool && pri <= this.pri) return false;
    const text = this.pick(key, vars);
    if (!text) return false;
    this.say = text; this.pri = pri; this.until = now + hold; this.cool = now + hold * 0.75;
    return true;
  }
  current(now) { return now < this.until ? this.say : null; }
}
