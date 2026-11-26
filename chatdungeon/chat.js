// The chat: a feed of messages, a cast of simulated regulars, and an optional read-only Twitch connection.
// No DOM, so the Node sims run the same chatters as the page.
import { COST, mulberry, CURSES, RELICS } from './game.js';

// Each regular has a habit (what they spend mischief on), a temper for votes, and things to say.
export const CAST = [
  { name: 'cursegoblin_', color: '#ff5d8f', every: 9, wants: [['curse', 3], ['trap', 2]], vote: ['elite', 'fight'],
    idle: ['i have so much mischief in my heart', 'curse him. curse him again', 'what if the floor was lava (please)', 'chat lets be evil'],
    got: ['GOT EM', 'thats my curse baby', 'hehehe', 'worth every point'], lost: ['my beautiful curse', 'ok that one was a dud'],
    fizzle: ['THE HAT??', 'who gave him a hat', 'hat diff'], low: ['smell that? its fear', 'one more. just one more'], die: ['worth it', 'gg ez (i did this)'] },
  { name: 'auntie_bev', color: '#ffb84d', every: 9, wants: [['bless', 1]], kind: true, vote: ['shrine', 'treasure'],
    idle: ['hello everyone! is this the dungeon', 'sweetie you are doing great', 'remember to drink water', 'such a nice young adventurer'],
    hurt: ['oh no!!', 'careful sweetie', 'OUCH', 'leave him ALONE'], low: ['hang in there!! auntie is saving up', 'somebody bless him please'],
    heal: ['there you go dear', 'a little blessing from auntie', 'feel better!!'], die: ['oh no :( well done though', 'next time sweetie'] },
  { name: 'goblinenjoyer', color: '#7ee05a', every: 8, wants: [['goblin', 1]], vote: ['fight', 'elite'],
    idle: ['goblin rights', 'release more goblins', 'goblins are people too', 'every room should have goblins in it'],
    got: ['GOBLIN WIN', 'thats my boy', 'gerald with the hit!!'], lost: ['noooo gerald', 'he had a family', 'GERALD', 'rip gerald the 4th'] },
  { name: 'batfacts', color: '#b59cff', every: 8, wants: [['bat', 1]], vote: ['fight', 'treasure'],
    idle: ['bat fact: bats are the only mammals that can really fly', 'bat fact: a bat can eat a thousand bugs in an hour', 'bat fact: most bats are not blind',
      'bat fact: a group of bats is called a colony', 'bat fact: some bats hum when they are happy'],
    got: ['bat fact: that one bit you', 'echolocated u'], lost: ['bat fact: he is resting now', 'bat fact: that hurt my feelings'] },
  { name: 'slimetime99', color: '#4ce0d2', every: 9, wants: [['slime', 1]], vote: ['fight', 'shrine'],
    idle: ['splorch', 'slime time', 'i am going to spawn a slime and nobody can stop me', 'slimes split if you hit them btw'],
    got: ['SPLORCH', 'slimed'], lost: ['he split into two smaller sadder slimes', 'splorch :('] },
  { name: 'bonezone', color: '#e8e2cf', every: 10, wants: [['skeleton', 1]], minFloor: 2, vote: ['elite', 'fight'],
    idle: ['spooky', 'i have a skeleton inside me right now', 'skeleton archers are underrated', 'bones'],
    got: ['bullseye', 'calcium wins again'], lost: ['he fell apart', 'bonezone in shambles'] },
  { name: 'trapdad', color: '#ff8a3d', every: 10, wants: [['trap', 1]], vote: ['treasure', 'fight'],
    idle: ['did you hear about the trap? it was a real spike in popularity', 'hi hungry, im trapdad', 'watch your step kiddo'],
    got: ['ha! got the point?', 'that was a sharp move'], miss: ['you dodged it like your chores'] },
  { name: 'mod_mabel', color: '#6fb8ff', every: 22, wants: [['bless', 1]], kind: true, mod: true, vote: ['shrine', 'treasure', 'fight'],
    idle: ['reminder: be nice in chat', 'commands are !spawn !trap !curse !bless and !left !right when the doors come up'] },
  { name: 'backseat_barry', color: '#ffd23f', every: 10, wants: [], vote: ['treasure', 'elite'],
    idle: ['you should dash more', 'i would have gone the other door', 'hit them with the sword part', 'have you tried not getting hit',
      'turn your brightness up', 'wait for the goblin to lunge first', 'you can swat arrows out of the air btw', 'pro tip: stand still less'],
    hurt: ['should have dashed', 'i saw that coming', 'skill issue'], low: ['HEAL', 'go to the shrine??'] },
  { name: 'pog_cannon', color: '#ff4fe0', every: 11, wants: [], vote: ['elite', 'treasure'],
    idle: ['POG', 'lets gooo', 'W streamer', 'hype hype hype'],
    hurt: ['LMAO', 'OOF', 'nooo', 'ouch'], kill: ['POG', 'CLEAN', 'W', 'BONK', 'get wrecked'] },
  { name: 'lurk_lord', color: '#9fa7b8', every: 40, wants: [], vote: ['shrine', 'fight'], idle: ['o7', '...', 'just lurking', 'hi'], die: ['o7'] },
];

const VOTE_WORDS = { 0: ['!left', '!left', '!vote left', '!left!!', '1'], 1: ['!right', '!right', '!vote right', '!right!!', '2'] };

export function parse(text) {
  const t = text.trim();
  const m = t.match(/^!(\w+)(?:\s+(\w+))?/);
  if (m) return { verb: m[1].toLowerCase(), arg: (m[2] || '').toLowerCase() };
  if (/^(1|2|left|right)$/i.test(t)) return { verb: t.toLowerCase(), arg: '', soft: true };
  return null;
}

export class Chat {
  constructor(game, { sim = true, seed = 1 } = {}) {
    this.g = game;
    this.sim = sim;
    this.rand = mulberry(seed ^ 0x5eed);
    this.feed = [];
    this.id = 0;
    this.say = []; // queued (delay, user, text)
    this.last = 0;
    this.t = 0;
    this.scripted = false;
    this.users = new Map(CAST.map(c => [c.name, { ...c, next: 1 + this.rand() * c.every }]));
    this.onMsg = null;
  }
  setGame(g) { this.g = g; this.say = []; for (const u of this.users.values()) u.next = 1 + this.rand() * u.every * 0.7; }
  r() { return this.rand(); }
  pick(a) { return a[(this.rand() * a.length) | 0]; }

  push(m) {
    m.id = ++this.id; m.at = this.t;
    this.feed.push(m);
    if (this.feed.length > 80) this.feed.splice(0, this.feed.length - 80);
    this.onMsg?.(m);
    return m;
  }
  sys(text, tone = 'sys') { return this.push({ kind: 'sys', text, tone }); }

  // a message from anyone, simulated or real; commands go to the game
  message(user, color, text) {
    const m = { kind: 'msg', user, color, text };
    const c = parse(text);
    if (c && this.g) {
      const res = this.g.command(user, c.verb, c.arg);
      if (res.why === 'unknown' && c.verb === 'help') { this.push(m); this.sys('Commands: !spawn bat / goblin / slime / skeleton, !trap, !curse, !bless, and !left or !right when the doors come up.'); return res; }
      if (res.why !== 'unknown' || !c.soft) { m.cmd = c.verb; m.res = res; }
    }
    this.push(m);
    this.bounced(m);
    return m.res;
  }

  // simulated lines, spaced out so the feed stays readable
  queue(user, text, delay = 0) { this.say.push({ t: this.t + delay + this.r() * 0.5, user, text }); }
  react(names, key, p = 1, delay = 0.3) {
    for (const n of [].concat(names)) {
      const u = this.users.get(n);
      if (!u || !u[key] || this.r() > p) continue;
      this.queue(n, this.pick(u[key]), delay + this.r() * 0.9);
    }
  }

  tick(dt) {
    this.t += dt;
    const g = this.g;
    if (!g) return;
    // drain queued lines
    if (this.say.length) {
      this.say.sort((a, b) => a.t - b.t);
      while (this.say.length && this.say[0].t <= this.t) {
        const s = this.say.shift();
        const u = this.users.get(s.user);
        this.message(s.user, u?.color || '#fff', s.text);
      }
    }
    if (!this.sim || this.scripted) return;
    for (const u of this.users.values()) {
      u.next -= dt;
      if (u.next > 0) continue;
      u.next = u.every * (0.5 + this.r());
      this.act(u);
    }
  }

  act(u) {
    const g = this.g, p = g.p;
    if (g.over) return;
    const fighting = g.chatOn;
    // kind chatters bless when it matters
    if (u.kind && fighting) {
      if (p.hp <= 2 || p.hp <= p.max - 2 && this.r() < 0.35) {
        if (g.pool >= COST.bless) return this.queue(u.name, this.pick(['!bless', '!bless', '!bless <3', '!bless']));
        if (p.hp <= 2 && u.low && this.r() < 0.5) return this.queue(u.name, this.pick(u.low));
      }
      if (!u.mod && this.r() < 0.4) return u.idle && this.queue(u.name, this.pick(u.idle));
    }
    if (u.wants.length && fighting && (!u.minFloor || g.floor >= u.minFloor)) {
      let tot = 0; for (const [, w] of u.wants) tot += w;
      let x = this.r() * tot, want = u.wants[0][0];
      for (const [k, w] of u.wants) { x -= w; if (x <= 0) { want = k; break; } }
      if (want === 'bless' && p.hp >= p.max && p.shield) want = null;
      // spawners are lazy: they wait for a fuller jar, so curses and blessings get a turn
      const lazy = want === 'curse' || want === 'bless' ? 0 : u.save ?? (this.r() * 9);
      if (want && g.pool >= COST[want] + lazy && this.r() < 0.85) {
        const txt = want === 'curse' || want === 'trap' || want === 'bless' ? '!' + want : (this.r() < 0.75 ? '!spawn ' + want : '!' + want);
        return this.queue(u.name, txt + (this.r() < 0.15 ? this.pick([' lol', ' hehe', ' >:)', '']) : ''));
      }
    }
    if (u.idle && this.r() < (u.wants.length ? 0.35 : 0.6)) this.queue(u.name, this.pick(u.idle));
  }

  // the game's events, as chat sees them
  event(e) {
    if (!this.sim || this.scripted) return;
    const g = this.g;
    switch (e.t) {
      case 'hurt': {
        if (e.user && this.users.has(e.user)) this.react(e.user, 'got', 0.8, 0.2);
        this.react(['pog_cannon', 'backseat_barry', 'auntie_bev'], 'hurt', 0.35);
        if (e.hp === 1) this.react(['auntie_bev', 'cursegoblin_', 'backseat_barry'], 'low', 0.6, 0.8);
        break;
      }
      case 'kill': {
        if (e.chat && this.users.has(e.chat)) this.react(e.chat, 'lost', 0.75, 0.2);
        if (e.elite || this.r() < 0.12) this.react('pog_cannon', 'kill', 1);
        break;
      }
      case 'bless': this.react(e.user, 'heal', 0.5); break;
      case 'fizzle': this.react(e.user, 'fizzle', 1, 0.2); break;
      case 'curse': if (this.r() < 0.4) this.react(['pog_cannon'], 'hurt', 0.6, 0.5); break;
      case 'voteOpen': {
        if (this.r() < 0.6) this.queue('mod_mabel', this.pick(['VOTE! !left or !right', 'doors are up: !left or !right', 'vote now chat: !left / !right']), 0.1);
        for (const u of this.users.values()) {
          if (this.r() < 0.22) continue;
          const i0 = u.vote.indexOf(e.doors[0]), i1 = u.vote.indexOf(e.doors[1]);
          let v = i0 < 0 && i1 < 0 ? (this.r() < 0.5 ? 0 : 1) : i1 < 0 ? 0 : i0 < 0 ? 1 : i0 <= i1 ? 0 : 1;
          if (this.r() < 0.18) v = 1 - v;
          this.queue(u.name, this.pick(VOTE_WORDS[v]), 0.3 + this.r() * 4.2);
        }
        break;
      }
      case 'voted': {
        if (e.none) break;
        const type = e.type;
        if (type === 'elite') this.queue(this.pick(['cursegoblin_', 'pog_cannon']), this.pick(['ELITE ROOM LETS GO', 'pain incoming', 'chat chose violence']), 0.6);
        else if (type === 'shrine') this.queue('auntie_bev', this.pick(['good choice chat', 'a nice rest :)']), 0.6);
        else if (type === 'treasure' && this.r() < 0.6) this.queue('pog_cannon', this.pick(['LOOT', 'shiny shiny']), 0.6);
        if (e.tie && this.r() < 0.6) this.queue('backseat_barry', 'a TIE? coin flip ig', 0.4);
        break;
      }
      case 'relic': this.queue(this.pick(['pog_cannon', 'auntie_bev', 'backseat_barry']), this.pick([`ooh ${RELICS[e.relic].name.toLowerCase()}`, 'shiny!!', 'W item', 'that item is mid tbh']), 0.5); break;
      case 'floor': this.queue('pog_cannon', this.pick([`FLOOR ${e.floor} LETS GO`, `floor ${e.floor}!!!`]), 0.6); if (e.floor >= 3 && this.r() < 0.6) this.queue('lurk_lord', 'o7', 1.4); break;
      case 'room': if (e.type === 'boss') { this.queue('bonezone', 'its got a HAMMER', 1.4); this.queue('pog_cannon', 'BOSS BOSS BOSS', 0.8); this.queue('mod_mabel', 'the ban ogre! be nice chat', 2.2); } break;
      case 'die': {
        this.queue('pog_cannon', 'F', 0.3); this.queue('lurk_lord', 'o7', 0.9); this.react(['auntie_bev', 'cursegoblin_'], 'die', 1, 0.8);
        if (this.r() < 0.6) this.queue('batfacts', 'F', 0.6);
        break;
      }
      case 'win': this.queue('pog_cannon', 'WE DID IT', 0.3); this.queue('auntie_bev', 'so proud of you!!', 0.8); this.queue('cursegoblin_', 'fine. gg', 1.4); this.queue('lurk_lord', 'o7', 1.8); break;
      case 'spike': if (e.user === 'trapdad' && this.r() < 0.3) this.react('trapdad', 'got', 1, 0.2); break;
    }
  }

  // when a command bounces, sometimes a chatter grumbles about it
  bounced(m) {
    if (!this.sim || !m.res || m.res.ok) return;
    const u = this.users.get(m.user);
    if (!u || this.r() > 0.35) return;
    const why = m.res.why;
    const line = why === 'jar' ? this.pick(['jar is empty :(', 'not enough mischief', 'SAVE UP CHAT', 'who spent all the mischief']) :
      why === 'crowded' ? this.pick(['too many monsters already lol', 'room is full']) : null;
    if (line) this.queue(u.name, line, 0.6);
  }
}

// ---------------------------------------------------------------- Twitch, read only
// Anonymous IRC over WebSocket: no login, no token. Messages arrive as { user, color, text }.
export function connectTwitch(channel, onMsg, onStatus) {
  channel = channel.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_]/g, '');
  if (!channel) { onStatus('bad', 'That channel name is empty.'); return null; }
  let ws, closed = false, joined = false, tries = 0;
  const open = () => {
    try { ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); } catch (e) { onStatus('error', 'Could not open a connection.'); return; }
    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/tags');
      ws.send('PASS SCHMOOPIIE');
      ws.send('NICK justinfan' + (10000 + Math.floor(Math.random() * 80000)));
      ws.send('JOIN #' + channel);
      onStatus('connecting', `Joining #${channel}…`);
    };
    ws.onmessage = (ev) => {
      for (const line of String(ev.data).split('\r\n')) {
        if (!line) continue;
        if (line.startsWith('PING')) { ws.send('PONG' + line.slice(4)); continue; }
        let rest = line, tags = {};
        if (rest[0] === '@') { const sp = rest.indexOf(' '); for (const kv of rest.slice(1, sp).split(';')) { const [k, v] = kv.split('='); tags[k] = v; } rest = rest.slice(sp + 1); }
        const m = rest.match(/^:(\w+)!\S+ PRIVMSG #\S+ :(.*)$/);
        if (m) { onMsg({ user: tags['display-name'] || m[1], color: tags.color || null, text: m[2] }); continue; }
        if (/ 366 /.test(rest) || / ROOMSTATE /.test(rest)) { if (!joined) { joined = true; tries = 0; onStatus('live', `Reading #${channel}`); } }
        if (/ NOTICE /.test(rest)) onStatus('error', rest.split(' :').slice(1).join(' :') || 'Twitch said no.');
      }
    };
    ws.onclose = () => {
      if (closed) return;
      joined = false;
      if (++tries > 4) { onStatus('error', 'Lost the connection to chat.'); return; }
      onStatus('connecting', 'Reconnecting…');
      setTimeout(open, 1500 * tries);
    };
    ws.onerror = () => {};
  };
  open();
  return { channel, close() { closed = true; try { ws?.close(); } catch {} } };
}
