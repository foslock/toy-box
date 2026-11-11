// Spire Keeper — the stream chat. Fake regulars react to what happens in the fight.
const ADJ = ['moss', 'tiny', 'soggy', 'crispy', 'lurking', 'feral', 'polite', 'sleepy', 'grumpy', 'cosmic', 'damp', 'spicy', 'quiet', 'loud', 'brave', 'wobbly', 'salty', 'humble', 'certified', 'retired'];
const NOUN = ['goblin', 'turnip', 'dad', 'toad', 'pigeon', 'wizard', 'gremlin', 'teapot', 'crab', 'ferret', 'knight', 'lich', 'potato', 'moth', 'bard', 'golem', 'nan', 'raccoon', 'slug', 'owl'];
const COLORS = ['#f4d775', '#f4a3b8', '#93cdf2', '#a9e39d', '#f6ad62', '#c9adf2', '#f27c6c', '#9fe0d6'];

export const LINES = {
  idle: ['hi chat', 'first', 'pip pls', 'o7', 'lurking', 'W stream', 'keeper cooking?', 'is the keeper awake', 'what deck is this', 'love the chalk', 'pipLurk', 'hello from work', 'did i miss anything'],
  pickMonster: ['{m} lets go', 'oh no not the {m}', 'keeper is evil lol', '{m}?? pip is cooked', 'here we go', 'oh this will hurt', 'send it'],
  pickBoss: ['BOSS TIME', 'chat this is it', 'the {m}!!', 'here we gooo', 'hands shaking rn'],
  pickCamp: ['campfire stream zzz', 'cozy', 'healing arc', 'ok she needed that', 'marshmallows?', 'nap time'],
  pickTreasure: ['SHINY', 'ooo relic', 'loot!!', 'what does it do', 'free stuff'],
  pickEvent: ['ooh mystery', 'don\'t touch it pip', 'this is how horror movies start', 'sus'],
  bigHit: ['OUCH', 'that\'s gotta hurt', 'she\'s cooked', 'it\'s over', 'F', 'pipCry', 'BLOCK PIP', 'oof', 'my HP hurts watching this', 'NOO'],
  greedyHit: ['she never blocks lol', 'greedy pip strikes again', 'why didn\'t she block', 'defend exists pip', 'classic pip'],
  lowHp: ['she\'s on {hp}', 'heal pls', 'keeper chill', 'i can\'t watch', 'hands sweating', '{hp} HP...', 'pipCry pipCry'],
  clutch: ['WE\'RE SO BACK', 'CLUTCH', 'LETS GOOO', 'HOLY', '!!!!!', 'pipHype pipHype pipHype', 'clip it', 'CLIP THAT', 'i screamed', 'HOW'],
  pillow: ['THE PILLOW', 'saved by a pillow lmao', 'PILLOW CLUTCH'],
  snooze: ['zzz', 'is this a podcast', 'too easy', 'keeper gave her a puppy', 'boring', 'skip', 'yawn', 'next pls'],
  dragged: ['this fight is forever', 'still going?', 'just hit it'],
  win: ['GG', 'ez', 'W', 'next', 'nice', 'gg go next'],
  winHard: ['GG!!', 'what a fight', 'HUGE', 'pipHype', 'heart rate 180'],
  death: ['NOOOO', 'F', 'F', 'F', 'o7 pip', 'keeper did this', 'rip stream', 'it\'s so over', 'pipCry', 'i blame the keeper'],
  shiny: ['of course she took {c}', 'shiny brain', 'big number = good', 'she always takes the big one', '{c} pog'],
  bored: ['anyone else bored', 'switching streams', 'wake me up at the boss', 'zzz', 'chat is dead', 'boring floor'],
  hypeUp: ['HYPE', 'pipHype', 'this is peak', 'chat is ALIVE'],
  poison: ['poison stream', 'spores lol', 'she\'s turning green'],
  str: ['he\'s getting stronger uh oh', 'that\'s not good', 'buffing??'],
  block: ['good block', 'smart pip', 'shield up'],
  heal: ['phew', 'heal!!', '+HP'],
  shuffle: ['shuffle', 'new deck who dis'],
  topRest: ['she made it!!', 'TOP OF THE TOWER', 'GG KEEPER'],
};

export class Chat {
  constructor(el) {
    this.el = el; this.q = []; this.t = 0; this.users = []; this.idleT = 3;
    for (let i = 0; i < 48; i++) {
      const a = ADJ[(Math.random() * ADJ.length) | 0], n = NOUN[(Math.random() * NOUN.length) | 0];
      const style = (Math.random() * 4) | 0;
      const name = style === 0 ? `${a}_${n}` : style === 1 ? `${a}${n[0].toUpperCase()}${n.slice(1)}` : style === 2 ? `${n}${(Math.random() * 99) | 0}` : `xx${n}xx`;
      this.users.push({ name, color: COLORS[i % COLORS.length] });
    }
  }
  clear() { this.el.textContent = ''; this.q = []; }
  // queue a reaction: kind from LINES, n messages over a little while
  say(kind, n = 1, vars = {}, spread = 0.8) {
    const pool = LINES[kind]; if (!pool) return;
    this.lastLine = this.lastLine || {};
    for (let i = 0; i < n; i++) {
      let s;
      do s = pool[(Math.random() * pool.length) | 0]; while (pool.length > 1 && s === this.lastLine[kind]);
      this.lastLine[kind] = s;
      s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
      this.q.push({ at: this.t + Math.random() * spread + i * 0.12, text: s });
    }
  }
  system(text) { this.q.push({ at: this.t, text, sys: true }); }
  tick(dt, rate = 0.3) {
    this.t += dt;
    this.idleT -= dt * rate;
    if (this.idleT <= 0) { this.idleT = 2 + Math.random() * 4; this.say('idle', 1); }
    this.q.sort((a, b) => a.at - b.at);
    while (this.q.length && this.q[0].at <= this.t) this.post(this.q.shift());
    if (this.q.length > 24) this.q.splice(0, this.q.length - 24);
  }
  post(m) {
    const li = document.createElement('div');
    li.className = m.sys ? 'msg sys' : 'msg';
    if (m.sys) li.textContent = m.text;
    else {
      const u = this.users[(Math.random() * this.users.length) | 0];
      const b = document.createElement('b'); b.textContent = u.name; b.style.color = u.color;
      li.append(b, document.createTextNode(' '));
      // emotes get a little chalk badge
      m.text.split(' ').forEach((w, i) => {
        if (i) li.append(' ');
        if (/^pip[A-Z]/.test(w) || w === 'o7') { const e = document.createElement('i'); e.className = 'emote'; e.textContent = w; li.append(e); }
        else li.append(w);
      });
    }
    this.el.append(li);
    while (this.el.children.length > 60) this.el.firstChild.remove();
    this.el.scrollTop = this.el.scrollHeight;
  }
}
