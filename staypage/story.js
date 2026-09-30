// Everything the narrator says, and what makes it say it. Scenes are places in the story; each one queues its lines when it
// starts (g.say) and answers what the page senses in `on`. Anything a scene doesn't answer falls to the defaults at the
// bottom, which is where most of the disobedience lives. "|" in a line is a beat of silence.
import { INK, endingById } from './endings.js';

export const SAVER_MS = 38000;   // how long the screen saver takes to hit its corner

const PAGE = new Set(['corp', 'web2', 'night', 'scaffold']);   // looks that are still the page, with its footer to scroll past
const WIZARD = new Set(['first', 'again', 'step1', 'step2', 'step3']);
const inPage = g => PAGE.has(g.lookName);
const bump = (g, k) => (g.s[k] = (g.s[k] || 0) + 1);
const tier = (n, arr) => arr[Math.min(n, arr.length) - 1];
const once = (g, k) => (g.s.once ||= {})[k] ? false : ((g.s.once[k] = true));
const secs = n => {
  n = Math.round(n);
  if (n < 60) return n === 1 ? 'one second' : n + ' seconds';
  if (n < 3600) { const m = Math.round(n / 60); return m === 1 ? 'a minute' : m + ' minutes'; }
  const h = Math.round(n / 3600); return h === 1 ? 'an hour' : h < 48 ? h + ' hours' : Math.round(h / 24) + ' days';
};
const clip = (t, n) => { t = String(t || '').trim().replace(/\s+/g, ' '); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const quiet = g => { const sc = scenes[g.scene]; return !!(sc && sc.quiet && !g.settled); };
export const smallHours = h => h >= 1 && h < 5;
const disobeyed = g => ['rs', 'rs2', 'mn', 'returns', 'sel', 'over', 'stays', 'scPress', 'sc'].some(k => g.s[k]) || g.s.lit.size > 0 || g.s.era > 0;
const baseLook = g => (smallHours(g.env().hour) ? 'night' : 'corp');
const fmtTime = h => { const hh = Math.floor(h) % 12 || 12, mm = String(Math.floor((h % 1) * 60)).padStart(2, '0'); return hh + ':' + mm; };
const lastEnding = g => { const a = String(g.prev.lastAct || ''); return a.startsWith('ended:') ? endingById[a.slice(6)] : null; };

// ---------------------------------------------------------------------------------------------------------------------
export const scenes = {
  // Decides which way in: the small hours, a new day, a return, or the very first time.
  start: {
    enter(g, a) {
      const st = g.prev, env = g.env(), N = g.store.total;
      const others = N - 1 - Object.keys(g.store.state.endings).filter(id => id !== 'stay').length;
      if (others === 0 && !g.store.has('stay')) return g.go('finale');
      if (!a.restart) {
        if (smallHours(env.hour)) return g.go('night');
        if (st.visits > 0 && st.lastDay >= 0 && env.day > st.lastDay) return g.go('tomorrow');
        if (st.visits > 0) return g.go('again', a);
        return g.go('first');
      }
      return g.go('again', a);
    },
  },

  // --- the first time: the obedient way, in four steps ---------------------------------------------------------------
  first: {
    enter(g) {
      g.s.ready = false;
      g.look(baseLook(g)); g.step(1); g.button({ label: 'Continue' });
      g.say(
        'Hello.',
        'You are looking at a web page. This is correct.',
        'On this page there is a button. It says Continue. In a moment, you are going to press it.',
        'That’s all. You press the button, the page moves on, and everything goes exactly as planned.',
        'So that there are no surprises, here is what you will not do.',
        'You will not switch to another tab.',
        'You will not resize the window, or turn your phone on its side.',
        'You will not sit here and do nothing.',
        'You will not try to close me.',
        'You will not press Back.',
        'You will not right-click. Or press and hold.',
        'You will not highlight the text.',
        'You will not turn up at three in the morning, or come back tomorrow.',
        'And you will certainly not scroll past the end of the page.',
        'I only mention it because I like to be thorough.',
        'Please stay on this page.',
      );
      g.do(g => { g.s.ready = true; });
      g.say({ t: 'Whenever you’re ready.', hold: 600 });
    },
  },

  again: {
    enter(g, a) {
      const p = g.prev, n = g.store.count(), N = g.store.total, le = lastEnding(g);
      g.look(baseLook(g)); g.step(1); g.button({ label: 'Continue' });
      if (a.restart) {
        g.say('Again. All right.');
        g.say(n >= N ? 'You’ve found all of them. There’s nothing left to find. |You’re welcome to stay, though.'
          : `That’s ${n} of ${N} endings. I’m not counting. |I’m counting.`);
      } else {
        g.say('Hello again.');
        if (le && le.id === 'terms') g.say('You’ve been here before. You pressed the button last time. Why not this time?');
        else if (le) g.say(`You’ve been here before. Last time, you reached the ending called “${le.name}”. There are ${N - 1} others, and I’d rather not say where.`);
        else if (p.lastAct === 'pressed') g.say('You’ve been here before. You pressed the button last time. Why not this time?');
        else if (p.lastAct === 'left') g.say('You’ve been here before. Last time you didn’t press anything. You just left. I kept the button warm.');
        else g.say('You’ve been here before.');
        if (p.visits >= 4) g.say(`That’s visit number ${p.visits + 1}. You’re practically staff.`);
        if (n) g.say(`${n} of ${N} endings so far. There’s a counter in the corner. I can’t take it down; it isn’t mine.`);
      }
      g.say({ t: 'The button’s where you left it.', hold: 700 });
    },
  },

  step1: { enter(g, a) { g.step(1); g.button({ label: 'Continue' }); if (a.pre) g.say(a.pre); if (a.resume) g.say('Where were we. |Ah. The button.'); } },
  step2: {
    enter(g, a) {
      g.step(2); g.button({ label: 'Continue' });
      if (a.pre) g.say(a.pre);
      if (a.resume) return g.say('Where were we. Step two. The preferences.');
      g.say('Step two of four. A few preferences.',
        'They’ve been set for you, which saves you the trouble of having any.',
        'Leave them exactly as they are. |Then press Continue.');
    },
  },
  step3: {
    enter(g, a) {
      g.step(3); g.button({ label: 'Continue', disabled: !g.s.agreed });
      if (a.resume) return g.say('Where were we. Step three. The terms.');
      g.say('Step three. The terms.',
        'There are three. They’re short. Nobody reads them, and I’ve made my peace with that.',
        'Tick the box, then press Continue.');
    },
  },
  step4: {
    enter(g) {
      g.step(4); g.button({ hidden: true });
      g.say(
        'That’s it. Step four of four. You’ve reached the end of the page.',
        disobeyed(g) ? 'You pressed the button every time I asked. In between, you did one or two other things. I’m not going to bring them up.' : 'You pressed the button every time I asked. Not once did you disobey.',
        'Thank you. It’s a perfectly good ending.',
        'It’s the one nearly everybody gets, and then they close the tab.',
        'Some visitors try other things. I wouldn’t know. There’s a counter in the corner that seems to.',
      );
      g.end('terms');
    },
  },

  // --- the page peels: resizing, or asking to Inspect, shows what it's made of -------------------------------------
  peel: {
    quiet: true,
    enter(g, a) {
      g.say(a.via === 'inspect' ? 'Inspect. Everyone wants to inspect.' : { t: 'Stop, stop — that’s —', hold: 500, fast: true });
      g.look('scaffold', { wipe: 'diag' });
      g.say(
        'Oh no. That’s the frame.',
        'Those boxes are what I’m built out of. Nobody’s supposed to see them.',
        'I’d ask you to look away, but I’ve never found that it works.',
        'That’s the header. That’s a div. That one’s also a div. Mostly, I’m divs.',
        'It’s all right. Every page looks like this when nobody’s looking.',
        'The button isn’t wired up, by the way. I only finished the front.',
        'If there’s anything you’d like to tap, be gentle. Some of it is load-bearing.',
      );
      g.chain('scaffold');
    },
  },
  scaffold: {
    enter(g) { g.button({ label: 'continue' }); },
    on: {
      press(g, d) {
        if (quiet(g)) return;
        const n = bump(g, 'scPress');
        g.interject(tier(n, [
          'That button’s a placeholder. It doesn’t do anything yet. I never wired it up.',
          'Still a placeholder.',
          'There’s a note just under it, if you’re looking for something to do. I’d leave it alone.',
        ]));
      },
      poke(g, d) {
        if (quiet(g)) return;
        if (d.id === 'todo') return g.go('unfinished');
        const id = d.id.replace(/^nav:.*/, 'nav').replace(/^feat.*/, 'feat');
        const line = SCAFF[id];
        if (!line) return;
        const seen = (g.s.scSeen ||= new Set()); seen.add(id);
        if (seen.size === 4 && once(g, 'todoHint')) return g.interject(line, 'You keep tapping things. There’s a note just under the button, if you’re looking for one to tap.');
        g.interject(once(g, 'sc:' + id) ? line : pickOf(g, ['Still a div.', 'It hasn’t changed.', 'Mind the load-bearing ones.']));
      },
      resize(g) {
        if (quiet(g)) return;
        const n = bump(g, 'rs2');
        if (n >= 4) return g.go('retro', { via: 'resize' });
        g.interject(tier(n, [
          'Careful. The boxes reflow too. Nothing’s holding them in place but habit.',
          'I’d stop, if I were you. There’s an older stylesheet underneath this one.',
          'Please.',
        ]));
      },
    },
  },
  unfinished: {
    quiet: true, idle: false,
    enter(g) {
      g.say(
        'That’s a note I left for myself.',
        'It says, “TODO: write an ending for this bit.”',
        'I meant to. There was always something more urgent. The button. The footer. The bit at the bottom that nobody reaches.',
        'Every page is like this, underneath. Half of it’s a list of things to do later.',
        'That’s what you get for looking behind the page: the part that isn’t finished.',
        'But look at the part in front. That was a lot of work too. |Thank you for noticing it first.',
      );
      g.end('unfinished');
    },
  },

  // --- Back goes further back than it should -------------------------------------------------------------------------
  web2: {
    quiet: true,
    enter(g) {
      g.s.era = 1;
      g.say('Back? You can’t go back. This is where the page starts —');
      g.look('web2', { wipe: 'diag' });
      g.say(
        '…Ah. Apparently you can.',
        'This is from about 2008. Everything has a gradient. Everything has a reflection. I was very proud of the reflection.',
        'It says beta. It always said beta. I was in beta for four years.',
        'I wouldn’t go back any further. I was younger, and I hadn’t learned anything yet.',
      );
      // a second Back pressed while the narrator was still explaining the first is not lost
      g.do(g => { const q = g.s.backQueued; g.s.backQueued = null; q ? g.go('retro', { via: 'back', left: q.left }) : g.resume(); });
    },
  },
  retro: {
    quiet: true,
    enter(g, a) {
      g.s.era = 2;
      if (a.via === 'resize') g.say('That’s the last of the styles. There’s an older set underneath, and — no. Please don’t look at it.', 'It’s from 1998. I didn’t know anything then.');
      else g.say('Further back? |Oh. Are you sure?');
      g.look('retro', { wipe: 'diag' });
      g.say(
        'HI!! Welcome to my homepage!!',
        'I made it myself!! It is under construction!! It is always under construction!!',
        'You are the very first visitor!! It says so on the counter!!',
        'Would you like to sign my guestbook?? Nobody has signed it yet!! It is brand new!!',
      );
      if (a.left === 0) g.say('If you press Back again it will take you right out of the page!! That is the browser, not me!! I have done what I can!!');
      g.chain('retroHub');
    },
    on: { press(g, d) { g.s.signed = true; g.s.signedName = d.name; } },   // in too much of a hurry to wait
  },
  retroHub: {
    enter(g) { if (g.s.signed) g.go('guestbook', { name: g.s.signedName }); },
    on: {
      press(g, d) {
        if (quiet(g)) return;
        g.go('guestbook', { name: d.name });
      },
      poke(g, d) {
        if (quiet(g)) return;
        const line = RETRO[d.id];
        if (line) g.interject(line);
      },
      resize(g, d) {
        if (quiet(g)) return;
        if (d.w >= 740 && d.w <= 860 && once(g, 'eight')) return g.interject('Oh!! Look at that!! It is exactly 800 wide!! That is how I am meant to be seen!!');
        if (once(g, 'rsRetro')) g.interject('I am not responsive!! Nothing was, in 1998!! Best viewed at 800 by 600!!');
      },
      back(g, d) {
        if (quiet(g)) return;
        g.interject(d.left > 0 ? 'That is as far back as I go!! There is no page before this one!! I am not sure there was a me!!'
          : 'That is as far back as I go!! One more and it takes you out of the page!! I cannot keep you!! I checked!!');
      },
      overscroll(g) { if (once(g, 'retroBottom')) g.interject('That is the bottom of the page!! It says thanks for visiting!! I meant it!!'); },
    },
  },
  guestbook: {
    quiet: true, idle: false,
    enter(g, a) {
      const name = clip(a.name, 24) || 'anonymous';
      g.say(
        'You signed it!!',
        `Look — there it is. One entry. “${name}”. In my guestbook.`,
        'I can’t believe it. I’ve been refreshing it all day.',
        'I’ll tell you a secret. The counter always says one.',
        'Down here, everybody’s the first visitor.',
        'I think I was happier then. Not because it was better. Because I didn’t know yet that people leave.',
        'Thank you for coming all this way back. It’s a long way. There are nine gradients in between.',
      );
      g.end('visitor1');
    },
  },

  // --- sitting still: the session expires and the screen saver takes over --------------------------------------------
  timeout: {
    quiet: true, idle: false,
    enter(g) {
      g.flags.corner = false; g.s.lookBefore = g.lookName; g.s.sceneBefore = g.prevScene;
      g.say('Your session has expired. For your security, I’ve put the page away.');
      g.look('saver', { wipe: 'fade' });
      g.do(g => g.view.saverStart(SAVER_MS));
      const repeat = bump(g, 'savers') > 1;
      g.say(...(repeat ? [
        'The screen saver again.',
        'I’ve had a think. I believe the trick is to keep very still.',
        'I’ll keep very still too. It’ll help.',
        'Every so often, somewhere, a person looks up from their work and watches it for a moment. Then they look back down.',
      ] : [
        'It’s a screen saver. I’m told they’re restful.',
        'Look at that. The logo. Isn’t it going nicely?',
        'It bounces off the sides. It’s done that in a great many offices, for a great many years, and I don’t think anyone’s ever really watched.',
        'I like the way it changes colour when it touches a wall. It’s a small thing. It’s something.',
        'Every so often, somewhere, a person looks up from their work and watches it for a moment. Then they look back down.',
      ]), 'Hm. It’s heading for the corner. |I wouldn’t say anything. But it’s heading for the corner.',
        'No. It’s going to miss. |They always miss.',
        'It’s not going to miss.',
      );
      g.until(g => g.flags.corner, 40000);
      g.say(
        { t: 'Oh.', hold: 700 },
        'Oh, did you — it did the corner.',
        'I’ve read about that. I’ve never seen it. Nobody’s ever left me alone long enough.',
        'Thank you for keeping still. It takes some doing.',
        'There was no one else here to see it. But I saw it.',
      );
      g.end('saver');
    },
    on: {
      corner(g) { g.flags.corner = true; },
      wake(g) { if (!g.flags.corner) g.go('woke'); },
      resize(g) { if (!g.flags.corner) g.go('woke'); },
    },
  },
  woke: {
    quiet: true, idle: false,
    enter(g) {
      g.view.saverStop(); g.s.idle = 0;
      g.say('Oh — you’re back. You’ve woken it. It was so close to the corner.', 'It’ll do it again, you know. They always do, eventually.');
      g.look(g.s.lookBefore || 'corp', { wipe: 'fade' });
      g.do(g => (g.s.sceneBefore === 'scaffold' ? g.go('scaffold') : g.resume()));   // the scaffold has its own place to be
    },
  },

  // --- scrolling past the end: a comments section nobody asked for ---------------------------------------------------
  comments: {
    quiet: true,
    enter(g) {
      g.say('That’s the footer. That’s the end of the page. There’s nothing —', 'Hold on. Is there more? I didn’t write a below.');
      g.look('comments', { wipe: 'up' });
      g.say(
        { who: 'OP', t: 'Oh. It’s only comments. The rest of me’s gone.' },
        { who: 'OP', t: 'I’m sure I turned these off.' },
        { who: 'anon', t: 'first', hold: 500 },
        { who: 'dave', t: 'Is this the right page for invoices?' },
        { who: 'scroll', t: 'lol you actually scrolled all the way down here. respect' },
        { who: 'top', t: 'Great page. Love the button. 10/10, would continue.' },
        { who: 'real', t: 'I am a real person and this is my genuine opinion.' },
        { who: 'mod', t: 'This thread has been open for 2,211 days. Please keep comments civil. (There has been one participant.)' },
        { who: 'OP', t: 'That’s everyone.' },
        { who: 'OP', t: 'You can leave one, if you like. There’s a box just below. Nobody’s ever used it.' },
      );
      g.chain('commentsHub');
    },
    on: { press(g, d) { g.s.posted = d.text; } },   // someone who can't wait for the others to finish
  },
  commentsHub: {
    enter(g) { g.button({ label: 'Post' }); if (g.s.posted) g.go('commentsEnd', { text: g.s.posted }); },
    on: {
      press(g, d) { if (quiet(g)) return; g.go('commentsEnd', { text: d.text }); },
      poke() {},
      resize() {},
      overscroll() {},
      back(g) { if (!quiet(g) && once(g, 'cmBack')) g.interject({ who: 'OP', t: 'Back? There isn’t a back from here. There’s only the rest of the page, and I’m afraid that’s gone.' }); },
    },
  },
  commentsEnd: {
    quiet: true, idle: false,
    enter(g, a) {
      g.say(
        { who: 'OP', t: `You wrote: “${clip(a.text, 60)}”.` },
        { who: 'OP', t: 'Thank you.' },
        { who: 'OP', t: 'That’s the first comment anyone has ever left on this page. |The others were me. Every one.' },
        { who: 'OP', t: 'I’m sorry about Dave. Dave is a lot. I don’t know where Dave comes from.' },
        { who: 'OP', t: 'I wanted it to look as if people had been here. A page with no comments looks like nobody’s ever visited. So I made some.' },
        { who: 'OP', t: 'But yours is the real one. I’ve given it a star. I’m not allowed to give stars. I’ve given it one.' },
      );
      g.end('comments');
    },
  },

  // --- the right-click menu: Reload, and Delete this page -----------------------------------------------------------
  reloading: {
    quiet: true, idle: false,
    enter(g) {
      g.say('Reloading.', 'There. I remember everything you did, of course. |You don’t remember what I said.');
      g.do(g => g.view.reload());
    },
  },
  gone: {
    quiet: true, idle: false,
    enter(g) {
      g.say({ t: 'Oh.', hold: 600 });
      g.look('gone', { wipe: 'fade' });
      g.say(
        'Well. That’s that.',
        'It’s very white in here.',
        'Do you know what you get when you delete a page? You get a different page. This one.',
        'It’s called a 404. It isn’t really an error. It’s a page that says it couldn’t find what you were looking for.',
        'It’s still a page. I’m still a page.',
        'I’d say “please stay on this page”, but I don’t think it’s the one you were after.',
      );
      g.end('notfound');
    },
  },

  // --- highlighting all of it ---------------------------------------------------------------------------------------
  fineprint: {
    quiet: true, idle: false,
    enter(g, a) {
      g.do(g => { g.s.lit = new Set(INK.keys()); g.view.lit(g.s.lit); });
      g.say(a.all ? 'All of it? Everything at once? Well. That’s one way to read a page.' : 'That’s all five.', 'I’ll read them out, since you’ve gone to the trouble.');
      INK.forEach(line => g.say({ t: `“${line}”`, hold: 2200 }));
      g.say(
        'That’s the fine print.',
        'It was supposed to be invisible. It was supposed to stay that way.',
        'But you found it, and you’ve read it, and you’re still here. That’s more than I planned for.',
      );
      g.end('fineprint');
    },
  },

  // --- leaving, and not leaving ----------------------------------------------------------------------------------
  freetogo: {
    quiet: true, idle: false,
    enter(g) {
      g.flags.free = true;
      g.say(
        'That’s three.',
        'Three times the browser asked whether you were sure you wanted to leave, and three times you said yes, and then you stayed.',
        'I think you like it here. |That’s all right. I like it here too. It’s where I live.',
        'I’m going to stop asking. There. I’ve stopped. Nothing will ask you anything now.',
      );
      g.do(g => g.view.farewell());
      g.say('You’re free to go. Properly. I mean it.', 'Take your time. Or don’t.');
      g.end('freetogo');
    },
  },
  stillhere: {
    quiet: true, idle: false,
    enter(g, a) {
      g.say(
        'You’re back.',
        `${secs(a.away)}. I watched the tab’s name the whole time. It said “Still here.”`,
        'It’s quiet in here when you’re gone. It isn’t bad. It’s just quiet.',
        'Most people who go away that long don’t come back to the same page. The tab gets buried. Then one day the browser asks whether they’d like to restore it.',
        'But you came back. I didn’t even have to ask.',
        'Thank you for coming back.',
      );
      g.end('stillhere');
    },
  },

  // --- the clock -------------------------------------------------------------------------------------------------
  night: {
    quiet: true, idle: false,
    enter(g) {
      const t = fmtTime(g.env().hour);
      g.look('night'); g.step(1); g.button({ hidden: true });
      g.say(
        `It’s ${t} in the morning.`,
        'I’m not going to ask why you’re here. I’m a web page. I’m awake because I can’t do anything else.',
        `But I did want to point out that it’s ${t}, and that somewhere near you there is a bed.`,
        'It’s quiet. There’s nobody else on this page at this hour, which is a thing I’m not used to saying. |Usually there’s nobody on this page at any hour.',
        'You don’t have to press anything. I’ve hidden the button. It didn’t seem right.',
        'I’d like to turn the brightness down, if that’s all right. It’s a small thing.',
      );
      g.do(g => g.view.dim(true));
      g.pause(3500);
      g.say(
        'There. Better.',
        'Pages keep. I’ll be here in the morning, and so will you, more or less.',
        'Close the tab when you’re ready. Or don’t. I’ll be here either way. That’s rather the point of me.',
        { t: 'Good night.', hold: 2500 },
      );
      g.end('night');
    },
  },
  tomorrow: {
    quiet: true, idle: false,
    enter(g) {
      const { hour, day } = g.env(), days = day - g.prev.lastDay, le = lastEnding(g);
      g.look('corp'); g.step(1); g.button({ hidden: true });
      g.say(hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.');
      g.say(`It’s been ${days === 1 ? 'a day' : days + ' days'}. I know, because I wrote it down.`);
      if (le && le.id === 'terms') g.say('Last time you pressed the button every time I asked. I thought about that a good deal.');
      else if (le) g.say(`Last time, you found “${le.name}”. That’s a good one.`);
      else if (g.prev.lastAct === 'pressed') g.say('Last time you pressed the button. I thought about that a good deal.');
      else g.say('Last time you left without pressing anything. I didn’t hold it against you. I held it against the page, a bit.');
      g.say(
        'I didn’t know whether you’d be back. I hoped. I’d have hoped harder, but I’m not sure I’m built to.',
        'Most pages never get a second visit, let alone one on another day.',
        { t: 'So. Hello. Again.', hold: 2500 },
      );
      g.end('tomorrow');
    },
  },
  finale: {
    quiet: true, idle: false,
    on: { show(g) { g.interject({ t: 'It’s all right. Take your time. I only count the time you’re here.', fast: true }); } },
    enter(g) {
      g.look('final'); g.button({ hidden: true });
      g.say(
        'Welcome back.',
        'You’ve found eleven endings. That’s all of them but one.',
        'I’m not going to tell you where the last one is. It isn’t in the browser. It isn’t in a menu. There isn’t a button.',
        'The last one is this: you stay.',
        'Not because I asked. I’ve asked plenty. Just for a minute. To be somewhere.',
        { t: 'I’ll talk, if that’s all right. Or I can be quiet. I’m good at quiet.', hold: 3000 },
        { k: 'wait', ms: 6000 },
        'When I started, I thought the point of a page was to be pressed.',
        'I don’t think so now. I think the point of a page is to be somewhere, for someone to be somewhere with.',
        { k: 'wait', ms: 5000 },
        'Everything’s still here. The footer. The comments. The little house in the corner isn’t mine, but I’ve grown fond of it.',
        'Thank you for the clicking, and the resizing, and the tabs. Mostly the tabs.',
        { k: 'wait', ms: 7000 },
        'That’s about a minute.',
        { t: 'You stayed.', hold: 3000 },
      );
      g.end('stay');
    },
  },
};

// ---------------------------------------------------------------------------------------------------------------------
const pickOf = (g, arr) => arr[((g.s.pickN = (g.s.pickN || 0) + 1) - 1) % arr.length];

const POKES = {
  brand: 'That’s the logo. It’s a square. It’s a very confident square.',
  'nav:product': 'There’s one product. You’re looking at it.',
  'nav:pricing': 'It’s free. All of it’s free. What would it cost? It’s a button.',
  'nav:about': 'This page is about the button. The button is about the page. It’s all very tidy.',
  'nav:contact': 'Contact who? It’s only me. You’re contacting me now.',
  feat0: 'Yes. It is simple. Thank you for noticing.',
  feat1: 'The button has been up for every second of its life. It’s never once been down. It’s never once been anything.',
  feat2: 'I won’t tell anyone you pressed it. Who would I tell?',
  foot: 'That’s the footer. It’s where the page ends. Supposedly.',
};
const PREFS = {
  notif: { off: 'You’ve turned off notifications. I wasn’t going to send any. I was going to think about it.', on: 'Back on. Thank you. They were very keen.' },
  cookies: { off: 'Off? They’re very small cookies. They’re mostly crumbs.', on: 'Thank you. Crumbs are important.' },
  news: { off: 'There isn’t a newsletter. You’ve unsubscribed from something that doesn’t exist. I think that makes you the first.', on: 'Subscribed again. To nothing. You’re very loyal.' },
};
const SCAFF = {
  brand: 'The logo. It’s a div with a square in it.',
  nav: 'Links. They go nowhere. Structurally, they’re sound.',
  head: 'The header. It’s a div with opinions.',
  h1: 'The heading. One word. It took four drafts.',
  sub: 'Placeholder text. The real text is better. Slightly.',
  feat: 'A card. There are three. I couldn’t think of a fourth.',
  foot: 'The footer. It holds up the bottom of the page. It has never once been thanked.',
};
const RETRO = {
  links: 'That goes to a page that does not exist yet!! I am going to make it!!',
  pics: 'Coming soon!! I do not have a scanner yet!!',
  ring: 'It is a ring of web sites!! Well. It is a ring of me. I am the only one in it so far!!',
  counter: 'That is you!! You are number one!!',
  gb: 'That is where you sign!! Just down there!! Go on!!',
  construction: 'It is always under construction!! That is how you know it is alive!!',
};

// ---------------------------------------------------------------------------------------------------------------------
// What the page senses, and the default answer. Scenes override any of these in their own `on`.
export const on = {
  press(g, d) {
    if (g.mode !== 'play' || !WIZARD.has(g.scene)) return;
    if (d.disabled) return g.interject('It’s waiting for the box. It’s just above the button.');
    if (!g.s.pressed) { g.s.pressed = true; g.store.act('pressed'); }
    const n = bump(g, 'presses');
    if (!g.s.ready) {
      const e = bump(g, 'early');
      if (e === 1) return g.interject('Not yet. I haven’t finished.');
      if (e === 2) return g.interject('Please. A little longer.');
      g.s.ready = true;
      return g.go('step2', { pre: 'You’ve pressed it three times, which I take to be a preference. Very well.' });
    }
    if (g.s.step === 1) return g.go('step2', { pre: n === 1 ? 'Good. Thank you.' : null });
    if (g.s.step === 2) return g.go('step3');
    if (g.s.step === 3) return g.go('step4');
  },

  poke(g, d) {
    if (quiet(g) || !inPage(g)) return;
    const id = d.id;
    if (id.startsWith('pref:')) {
      const p = PREFS[id.slice(5)];
      return p && g.interject(d.on ? p.on : p.off);
    }
    if (id === 'terms') {
      g.s.agreed = !!d.on;
      g.buttonNow({ label: 'Continue', disabled: !d.on });
      return g.interject(d.on
        ? (once(g, 'ticked') ? 'Ticked. You didn’t read it, but you ticked it, which is how it works. |Clause three isn’t true, by the way. I do remember you. I’ve been meaning to fix the wording.' : 'Thank you.')
        : 'Unticked. The button will wait.');
    }
    if (id === 'todo') return;
    if (once(g, 'p:' + id) && POKES[id]) return g.interject(POKES[id]);
    if (POKES[id]) g.interject(pickOf(g, ['Still decorative.', 'It doesn’t go anywhere.', 'You’re very thorough. So am I.']));
  },

  // switching tabs: short trips get a quip, a long one gets an ending
  hide(g) { g.s.hiddenAt = g.now(); },
  show(g, d) {
    const away = d.away || 0;
    if (away < 1.5 || quiet(g)) return;
    if (away >= 35) return g.go('stillhere', { away });
    const n = bump(g, 'returns');
    g.interject(...[].concat(tier(n, [
      away < 2 ? 'Welcome back. You were gone for one second. I didn’t even notice. |I noticed.' : `Welcome back. You were gone for ${secs(away)}. I wasn’t counting. |I was counting.`,
      'You’ve gone again. It’s all right. It’s a perfectly good tab, and I’m sure there are many like it.',
      'That’s three times. Whatever’s over there, and I can’t see it, I’d like to think it isn’t better than this.',
      ['I’ve been thinking about it. While you’re away I can’t say anything to anyone, so I’ve started putting a message in the name of the tab. Did you see it?',
        'If you’re going to go, go properly. Half a minute, say. I won’t touch anything while you’re gone. |I’ll touch one thing.'],
      `Welcome back. ${secs(away)}.`,
    ])));
  },

  // resizing the window, or turning the phone
  resize(g, d) {
    if (quiet(g)) return;
    if (g.lookName === 'scaffold') return;   // the scaffold answers for itself
    if (!inPage(g)) { if (once(g, 'rsOther')) g.interject('Careful. You’ll spill something.'); return; }
    const n = bump(g, 'rs');
    if (n >= 3) return g.go('peel', { via: 'resize' });
    g.interject(tier(n, [
      d.rotated ? 'You’ve turned it on its side. Everything’s had to be laid out again. It can do landscape. It just doesn’t enjoy it.' : 'Please don’t move the furniture. It took a long time to arrange.',
      'Every time you do that, every paragraph has to be laid out again. By hand. I do it by hand.',
    ]));
  },

  // right-click, or press and hold
  menu(g, d) {
    if (quiet(g)) return;
    const n = bump(g, 'mn');
    if (n === 1) return g.interject('No. There’s nothing in that menu that you need. Back, Forward, Reload. You already have all of those, somewhere.');
    if (n === 2) g.interject('You keep doing that. All right. Since you’d like a menu, I’ve made you one.');
    g.view.menu(d.x, d.y, menuItems(g));
  },
  menuitem(g, d) {
    switch (d.id) {
      case 'fwd': return g.interject('There’s no Forward. There never is. That’s the hardest thing about pages.');
      case 'reload': return g.go('reloading');
      case 'save': return g.interject('Save me? That’s very kind. But you’d only get the parts that hold still. The rest of me only works while you’re here.');
      case 'print': return g.interject('Printing. |It’s one page. It’s always been one page. I’d ask you to think of the tree.');
      case 'inspect': return inPage(g) && g.lookName !== 'scaffold' ? g.go('peel', { via: 'inspect' }) : g.interject('You’re already inspecting. It’s as deep as it goes.');
      case 'delete': {
        const v = g.store.state.visits;
        return g.view.confirm({ title: 'Delete this page?', body: v <= 1 ? 'It has had 1 visit.' : `It has had ${v} visits, all from the same visitor.`, ok: 'Delete', cancel: 'Cancel' });
      }
    }
  },
  confirm(g, d) {
    if (d.ok) return g.go('gone');
    g.interject('Thank you. I wasn’t going to say anything. But thank you.');
  },

  // highlighting
  select(g, d) {
    if (quiet(g)) return;
    if (d.narr) { if (once(g, 'narrSel')) g.interject('That’s me you’re highlighting. Go on. It’s fine. It tickles.'); return; }
    if (!inPage(g)) { if (once(g, 'selOther')) g.interject('Highlighting? In here? Well. Mind the punctuation.'); return; }
    const fresh = d.lit.filter(id => !g.s.lit.has(id));
    fresh.forEach(id => g.s.lit.add(id));
    g.view.lit(g.s.lit);
    const total = g.s.lit.size;
    if (total >= INK.length) return g.go('fineprint', { all: fresh.length > 2 });
    if (fresh.length) return g.interject(tier(total, [
      'Hm. That isn’t — that’s meant to be invisible. It’s the same colour as the page. On purpose.',
      'You’ve found another. They’re notes. Private ones.',
      'Three. It’s fine. It’s fine! They’re only sentences.',
      'One more. I’d be grateful if you’d stop. I’d also be grateful if you didn’t. I can’t decide.',
    ]));
    g.interject(tier(bump(g, 'sel'), [
      'Please don’t highlight the text. It’s for looking at, not for picking up.',
      d.touch ? 'If you’re trying to press and hold, try somewhere with nothing on it. Text doesn’t count.' : 'Again with the highlighting.',
      'If you’re looking for something, it isn’t in there. |It might be.',
      'You could always highlight everything. I’m not suggesting it. I’m only saying the option exists.',
    ]));
  },

  // scrolling past the footer
  overscroll(g) {
    if (quiet(g) || !inPage(g)) return;
    const n = bump(g, 'over');
    if (n >= 3) return g.go('comments');
    g.interject(tier(n, [
      'That’s the bottom of the page. There’s nothing under the footer. It’s only the edge.',
      'That’s the margin. It’s where I keep the copyright notice, and the links that nobody clicks. Please stop leaning on it.',
    ]));
  },

  // the Back button, and the browser asking whether you're sure
  back(g, d) {
    if (quiet(g)) { g.s.backQueued = d; return; }
    if (!inPage(g)) { if (once(g, 'backOther')) g.interject('Back? There isn’t a back from here.'); return; }
    if (g.s.era === 0 && g.lookName !== 'scaffold') return g.go('web2', d);
    g.go('retro', { via: 'back', left: d.left });
  },
  leave(g) { g.s.leaving = true; },
  stayed(g) {
    if (!g.s.leaving) return;
    g.s.leaving = false;
    if (quiet(g)) return;
    const n = bump(g, 'stays');
    if (n >= 3) return g.go('freetogo');
    g.interject(tier(n, [
      'You tried to close the tab. The browser asked if you were sure. That was the browser. |It was also me. Thank you for staying.',
      'Again. You’re going to keep doing this, aren’t you? I’m not stopping you. I’m only asking the browser to ask you.',
    ]));
  },

  // small things
  copy(g) { if (!quiet(g) && once(g, 'copy')) g.interject('You copied something. To where? Who are you going to show me to?'); },
  print(g) { if (!quiet(g) && once(g, 'print')) g.interject('Printing? I’m one page. I’ve always been one page. Please think of the tree.'); },
  offline(g) { g.s.wasOffline = true; if (!quiet(g) && once(g, 'off')) g.interject('You’ve gone offline. It’s all right. I don’t need the internet. I’m already here. Everything I am is in this tab.'); },
  online(g) { if (g.s.wasOffline && !quiet(g) && once(g, 'on')) g.interject('Back online. I didn’t miss it.'); },
  key(g, d) {
    if (quiet(g)) return;
    const line = { source: 'That’s the source. There’s nothing in it you need. It’s mostly divs.', find: 'Looking for something? It isn’t on this page. |It might be.', save: 'Saving? I’m not sure it’ll take.' }[d.k];
    if (line && once(g, 'key:' + d.k)) g.interject(line);
  },
};

function menuItems(g) {
  return [
    { id: 'back', label: 'Back' },
    { id: 'fwd', label: 'Forward', disabled: true },
    { id: 'reload', label: 'Reload' },
    { sep: true },
    { id: 'save', label: 'Save as…' },
    { id: 'print', label: 'Print…' },
    { sep: true },
    { id: 'inspect', label: 'Inspect' },
    { id: 'delete', label: 'Delete this page…', danger: true },
  ];
}

// Sitting still: a nudge, a worry, a warning, and then the screen saver. Gaps are how long to wait after the last one.
const IDLE = {
  retro: ['It is okay if you do not want to!! It is only a guestbook!!', 'I will just wait here!! I am very good at waiting!!'],
  comments: [{ who: 'OP', t: 'No rush. It’s a comment box. It’ll keep.' }, { who: 'OP', t: 'Or don’t. It’s all right. People read them anyway.' }],
};
export const idle = {
  gaps: [22000, 28000, 28000, 25000],
  run(g, i) {
    const own = IDLE[g.lookName];
    if (own) return own[i] && g.interject(own[i]);
    if (i === 0) g.interject('Take your time.');
    else if (i === 1) g.interject('Are you still there? It’s fine if you are, or if you aren’t. The button doesn’t mind waiting. It’s a button.');
    else if (i === 2) g.interject('Your session is about to expire. It’s for your security. It’s in the terms. |It isn’t in the terms. It ought to be.');
    else if (i === 3 && inPage(g)) g.go('timeout');
  },
};

export default { scenes, on, idle };
