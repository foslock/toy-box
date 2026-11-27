import { wrap, COLS, ROWS, PAL } from './screen.js';
import { maze } from './g-maze.js';
import { turbo } from './g-turbo.js';
import { sunken } from './g-sunken.js';
import { hollow } from './g-hollow.js';
import { lamp } from './g-lamp.js';
import { foryou } from './g-foryou.js';

// ---------- 1992: GUESS THE NUMBER (QBasic, grey on black) ----------
function guess(api) {
  let lines, input, N, G, state, t = 0, wins = 0;
  const say = (s, fg = 7) => { for (const l of wrap(s, COLS)) lines.push({ s: l, fg }); };
  const HIGH = ['TOO HIGH', 'TOO HIGH!!', 'NO. LOWER.', 'TOO HIGH. TRY AGAIN', 'LOWER!!!!'];
  const LOW = ['TOO LOW', 'TOO LOW!!', 'NO. HIGHER.', 'TOO LOW. TRY AGAIN', 'HIGHER!!!!'];
  function start() {
    lines = []; input = ''; G = 0; state = 'ask';
    N = 1 + Math.floor(Math.random() * 100);
    if (api.demo) N = 37;
    say('GUESS THE NUMBER', 15); say('BY MAGS HALE (AGE 10 AND 3/4)', 7); say('');
    say('I AM THINKING OF A NUMBER FROM 1 TO 100.'); say('WHAT IS IT');
  }
  start();
  function submit() {
    if (!input) return;
    const x = parseInt(input, 10); lines.push({ s: '? ' + input, fg: 7 }); input = '';
    if (!(x >= 1 && x <= 100)) { say('1 TO 100 I SAID.', 12); api.sfx.bad(); return; }
    G++;
    if (x === N) {
      api.sfx.win(); wins++;
      say(''); say(`YES!!! YOU GOT IT IN ${G} GOES.`, 14);
      if (G <= 4) say('YOU CHEATED. YOU MUST HAVE CHEATED.');
      else if (G <= 7) say('VERY GOOD. NEARLY AS GOOD AS ME.');
      else say('THE SQUIRT COULD DO BETTER AND THEY ARE FOUR.');
      say(''); say('PLAY AGAIN (Y/N)'); state = 'again'; api.done(); return;
    }
    api.sfx.beep(x > N ? 330 : 660, 0.07);
    say(x > N ? HIGH[(G - 1) % HIGH.length] : LOW[(G - 1) % LOW.length]);
    if (x === 42) say('(THAT IS DADS AGE)', 8);
    if (G === 6) say('HURRY UP. MUM NEEDS THE COMPUTER FOR THE ACCOUNTS.', 11);
    if (G === 10) say(`OK HERE IS A CLUE. IT IS ${N % 2 ? 'ODD' : 'EVEN'}.`, 11);
    if (G === 14) {
      say(`I AM BORED NOW. IT WAS ${N}.`, 12); say(''); say('PLAY AGAIN (Y/N)'); state = 'again';
    }
  }
  return {
    get n() { return N; }, get lines() { return lines; },
    pad: () => (state === 'again' ? 'yn' : 'digits'),
    key(k) {
      if (state === 'ask') {
        if (/^[0-9]$/.test(k) && input.length < 3) { input += k; api.sfx.key(); }
        else if (k === 'back') input = input.slice(0, -1);
        else if (k === 'enter' || k === 'space') submit();
      } else if (state === 'again') {
        if (k === 'y' || k === 'enter') start();
        else if (k === 'n') { say('OK BYE'); state = 'bye'; setTimeout(() => api.exit(), 600); }
      }
    },
    tap() { if (state === 'again') start(); },
    tick(dt) { t += dt; },
    draw(scr) {
      scr.clear();
      const all = lines.slice();
      if (state === 'ask') all.push({ s: '? ' + input + ((t * 2 | 0) % 2 ? '_' : ' '), fg: 7 });
      const show = all.slice(-ROWS);
      show.forEach((l, i) => scr.text(0, i, l.s, l.fg));
    },
  };
}

// ---------- 1993: BISCUIT THE DOG (numbered choices, yellow on blue) ----------
const B = {
  start: { t: 'WE MOVED TO THE NEW HOUSE ON FERRY ROAD IN THE SUMMER. BISCUIT HATES IT.\n\nTHIS MORNING HIS BASKET IS EMPTY AND THE BACK GATE IS OPEN.', c: [['LOOK IN THE KITCHEN', 'kitchen'], ['LOOK IN THE GARDEN', 'garden'], ['ASK THE SQUIRT', 'squirt']] },
  kitchen: { t: (s) => s.sausage ? 'THE KITCHEN. MUM HAS NOT NOTICED ABOUT THE SAUSAGE YET. GOOD.' : 'THE KITCHEN. MUM IS ON THE PHONE TO GRANDMA ABOUT THE MOVE AGAIN.\n\nTHERE IS A SAUSAGE ON THE SIDE FROM BREAKFAST.',
    c: (s) => s.sausage ? [['GO BACK', 'start']] : [['TAKE THE SAUSAGE', 'took'], ['GO BACK', 'start']] },
  took: { t: 'YOU PUT THE SAUSAGE IN YOUR COAT POCKET. GROSS BUT USEFUL.', c: [['GO BACK', 'start']], fx: (s) => { s.sausage = true; } },
  garden: { t: 'PAW PRINTS IN THE MUD GO UNDER THE FENCE AND OFF DOWN THE HILL.', c: [['FOLLOW THEM', 'hill'], ['GO BACK', 'start']] },
  squirt: { t: 'THE SQUIRT IS EATING CEREAL WITH A FORK.\n\n"BISCUIT WENT HOME," THEY SAY.\n\nTHEY ARE FIVE AND DO NOT KNOW ANYTHING.', c: [['GO BACK', 'start']] },
  hill: { t: 'YOU FOLLOW THE PRINTS ALL THE WAY DOWN THE HILL, PAST THE BUS STOP AND THE SWINGS.\n\nTHERE IS THE SHOP.', c: [['GO IN THE SHOP', 'shop'], ['KEEP GOING', 'street'], ['GIVE UP', 'giveup']] },
  giveup: { t: 'YOU CANNOT GIVE UP ON BISCUIT. THAT IS THE RULES.', c: [['OK', 'hill']] },
  shop: { t: 'MR PATEL SAYS A SCRUFFY DOG WENT PAST AN HOUR AGO LOOKING VERY DETERMINED.\n\n"GOING HOME, I EXPECT," HE SAYS.\n\nBUT HOME IS THE OTHER WAY.', c: [['KEEP GOING', 'street'], ['BUY A MARS BAR', 'mars']] },
  mars: { t: 'YOU HAVE 12P. A MARS BAR IS 25P. MR PATEL GIVES YOU A FREDDO INSTEAD. IT IS NOT FOR BISCUIT. CHOCOLATE IS BAD FOR DOGS.', c: [['KEEP GOING', 'street']] },
  street: { t: 'YOU ARE ON ALBERT STREET. THE OLD HOUSE HAS NEW CURTAINS AND A DIFFERENT CAR.\n\nBISCUIT IS LYING ON THE STEP LIKE HE IS WAITING TO BE LET IN.',
    c: (s) => [['CALL HIM', 'call'], ['KNOCK ON THE DOOR', 'knock'], s.sausage ? ['GIVE HIM THE SAUSAGE', 'end'] : ['GO HOME', 'start']] },
  call: { t: 'YOU CALL HIM. HE LOOKS AT YOU. THEN HE LOOKS AT THE DOOR. HE DOES NOT COME.', c: (s) => [['GO BACK', 'street']], hint: (s) => (s.sausage ? '' : '(MAYBE IF YOU HAD SOMETHING HE LIKED...)') },
  knock: { t: 'A LADY OPENS THE DOOR. SHE IS NICE AND SAYS YOU CAN BOTH COME IN FOR A BIT.\n\nBUT IT IS HER HOUSE NOW. IT SMELLS DIFFERENT. YOU SAY NO THANK YOU.', c: [['GO BACK', 'street']] },
  end: { t: 'BISCUIT EATS THE SAUSAGE IN ONE GO. THEN HE LETS YOU PUT HIS LEAD ON.\n\nYOU WALK HOME THE LONG WAY SO HE CAN SNIFF EVERYTHING.\n\n             THE END\n\n(HE MISSES IT TOO. SO DO I. DONT TELL MUM.)', c: [['PLAY AGAIN', 'restart'], ['QUIT', 'quit']], fin: true },
};
function biscuit(api) {
  let s = { sausage: false }, node = 'start', t = 0, flash = -1;
  const val = (v) => (typeof v === 'function' ? v(s) : v);
  function choose(i) {
    const c = val(B[node].c)[i]; if (!c) return;
    api.sfx.beep(520 + i * 120, 0.06);
    if (c[1] === 'restart') { s = { sausage: false }; node = 'start'; return; }
    if (c[1] === 'quit') { api.exit(); return; }
    node = c[1]; B[node].fx?.(s);
    if (B[node].fin) { api.done(); api.sfx.win(); }
  }
  let rows = [];
  return {
    pad: 'choices',
    key(k) { if (/^[1-3]$/.test(k)) choose(+k - 1); else if (k === 'up' || k === 'down') {} },
    tap(x, y) { const r = Math.floor(y / 20); const hit = rows.find((q) => q.row === r); if (hit) choose(hit.i); },
    tick(dt) { t += dt; },
    draw(scr) {
      scr.clear(PAL[1]);
      scr.fill(0, 0, COLS, 1, 13);
      scr.text(1, 0, 'BISCUIT THE DOG  *  A MAGS HALE GAME', 15);
      let row = 2;
      for (const l of wrap(val(B[node].t), 38)) scr.text(1, row++, l, 14);
      const h = B[node].hint?.(s); if (h) { row++; for (const l of wrap(h, 38)) scr.text(1, row++, l, 11); }
      row = Math.max(row + 1, ROWS - 1 - val(B[node].c).length * 1 - 1);
      rows = [];
      val(B[node].c).forEach((c, i) => { scr.text(1, row, `${i + 1}) ${c[0]}`, 15); rows.push({ row, i }); row++; });
      if (s.sausage && node !== 'end') scr.text(30, 0, '', 15);
      scr.text(1, ROWS - 1, s.sausage && node !== 'end' ? 'POCKETS: 1 SAUSAGE' : 'POCKETS: NOTHING', 3);
    },
  };
}

export const PROGRAMS = { guess, biscuit, maze, turbo, sunken, hollow, lamp, foryou };
