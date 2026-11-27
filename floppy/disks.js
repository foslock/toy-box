// The shoebox. Eight disks, 1992 to 2001, everything Mags left on them.
// kind 'run' starts a program; kind 'text' opens it in the editor.

export const DISKS = [
  {
    id: 'guess', year: 1992, age: 10, color: '#2f3a4a', label: ['GUESS', 'MAGS GAMES #1', '1992'],
    vol: 'MAGS 1992',
    files: [
      { name: 'GUESS.EXE', size: '18,402', date: '03-14-92', kind: 'run', prog: 'guess' },
      { name: 'GUESS.BAS', size: '1,288', date: '03-14-92', kind: 'text', code: true, text:
`REM GUESS THE NUMBER
REM BY MAGS HALE AGE 10 3/4
REM MY FIRST GAME!!!!!!!!!

REM DAD SAYS RANDOMIZE TIMER MAKES
REM IT A DIFFERENT NUMBER EVERY TIME
RANDOMIZE TIMER
CLS
N = INT(RND * 100) + 1
G = 0
PRINT "GUESS THE NUMBER"
PRINT "BY MAGS HALE (AGE 10 AND 3/4)"

10 INPUT "WHAT IS IT"; X
G = G + 1
IF G = 6 THEN PRINT "HURRY UP"
IF X > N THEN PRINT "TOO HIGH": GOTO 10
IF X < N THEN PRINT "TOO LOW": GOTO 10
PRINT "YES!!! YOU GOT IT IN"; G; "GOES"

REM TODO MAKE IT SAY RUDE THINGS
REM TODO MAKE IT SAY RUDER THINGS

REM THE SQUIRT KEEPS PRESSING THE
REM KEYS WHEN I AM DOING THIS.
REM SQUIRT IF YOU ARE READING THIS
REM YOU CANT READ. HA` },
      { name: 'README.TXT', size: '402', date: '03-14-92', kind: 'text', text:
`GUESS THE NUMBER
VERSION 1.0
BY MAGS HALE

THIS IS MY FIRST GAME. I MADE IT ON DADS COMPUTER AT THE WEEKEND. DAD HELPED WITH THE RANDOM BIT BUT I DID ALL THE REST.

HOW TO PLAY: GUESS THE NUMBER.

WHEN I AM BIG I AM GOING TO MAKE GAMES LIKE SONIC BUT BETTER AND YOU WILL BE ABLE TO BE A GIRL.

DO NOT DELETE THIS DISK.
THIS MEANS YOU.` },
    ],
  },
  {
    id: 'biscuit', year: 1993, age: 11, color: '#7a2b2b', label: ['BISCUIT', 'THE DOG', 'V2!!'],
    vol: 'BISCUIT',
    files: [
      { name: 'BISCUIT.EXE', size: '31,770', date: '11-02-93', kind: 'run', prog: 'biscuit' },
      { name: 'README.TXT', size: '611', date: '11-02-93', kind: 'text', text:
`BISCUIT THE DOG
A ADVENTURE BY MAGS HALE
VERSION 2

(VERSION 1 GOT DELETED. SQUIRT.)

YOU PRESS THE NUMBERS TO PICK WHAT TO DO.

THIS IS BASED ON A TRUE STORY FROM LAST MONTH. BISCUIT IS FINE NOW. HE IS ASLEEP ON MY FEET WHILE I TYPE THIS.

WE MOVED TO THE NEW HOUSE ON FERRY ROAD IN THE SUMMER. MY ROOM IS BIGGER. THE NEW SCHOOL IS NOT OK. NOBODY THERE HAS EVEN HEARD OF QBASIC.

BISCUIT KEEPS GOING BACK TO THE OLD HOUSE. I DONT BLAME HIM.` },
      { name: 'BISCUIT.BAS', size: '6,104', date: '11-02-93', kind: 'text', code: true, text:
`REM BISCUIT THE DOG V2
REM IF YOU ARE READING THIS
REM YOU ARE A CHEAT

COLOR 14
REM 14 IS YELLOW. 13 IS PINK.
REM I LIKE 13 BUT IT LOOKS BAD

100 REM KITCHEN
PRINT "THERE IS A SAUSAGE ON THE SIDE."
INPUT C
IF C = 1 THEN S = 1: GOTO 100
IF C = 2 THEN GOTO 10

REM DAD SAYS GOTO IS BAD AND I
REM SHOULD USE SUBS. DAD HAS NEVER
REM MADE A GAME

500 REM THE OLD HOUSE
REM THIS BIT IS TRUE. HE WAS JUST
REM LYING ON THE STEP. WAITING.` },
    ],
  },
  {
    id: 'maze', year: 1994, age: 12, color: '#1f6b6b', label: ['MAZE CRAZE', 'COMPUTER', 'CLUB 94'],
    vol: 'MAZECRAZE',
    files: [
      { name: 'MAZE.EXE', size: '44,016', date: '05-20-94', kind: 'run', prog: 'maze' },
      { name: 'README.TXT', size: '780', date: '05-20-94', kind: 'text', text:
`MAZE CRAZE
by Mags Hale, Year 8

Made at Computer Club (Tuesdays and Thursdays in the IT room).

3 levels. Use the arrows. Get to the door. Watch out for the Gloop on level 2. There is a SECRET on level 3.

I drew all the mazes on graph paper first. It took ages.

Computer club is the best thing about this school. Mr Okafor lets us stay till five and he doesn't mind if we play Lemmings as long as we make something as well.

There's a girl called Priya in Year 8 who is better at QBasic than me which is very annoying. She showed me how to do the Gloop. She is my friend now.` },
    ],
  },
  {
    id: 'turbo', year: 1995, age: 13, color: '#b14a1a', label: ['TURBO', 'TURBO 95', 'MAGS + PRIYA'],
    vol: 'TURBO95',
    files: [
      { name: 'TURBO.EXE', size: '61,233', date: '10-30-95', kind: 'run', prog: 'turbo' },
      { name: 'README.TXT', size: '702', date: '10-30-95', kind: 'text', text:
`TURBO TURBO 95
by Mags & Priya

THE LAP COUNTER IS BROKEN. WE KNOW. Just count yourself. It goes wrong after lap 2 and we have looked at it for a WEEK.

Steer with the arrows. Race the Priya three times round. Grass is slow.

My car is called the Mags II. Priya's car is called the Priya. She did the AI so it is very good at winning.

We made this at Priya's in half term. Her house has a computer with a SOUND CARD and her mum makes the best samosas in the world and doesn't mind us staying up.` },
      { name: 'LAPS.BAS', size: '388', date: '10-30-95', kind: 'text', code: true, text:
`' THE LAP COUNTER
' (MAGS: it's broken)
' (PRIYA: it's YOUR bit)

SUB COUNTLAP
  IF CROSSED THEN
    LAP = LAP + 1
    IF LAP > 2 THEN LAP = LAP * 2 - 1
  END IF
END SUB

' why is it * 2 - 1
' I DON'T KNOW. I DIDN'T WRITE IT.
' you wrote it at 1am
' oh` },
    ],
  },
  {
    id: 'sunken', year: 1996, age: 14, color: '#3b2a6b', label: ['THE SUNKEN', 'KING', 'ch.1 (of 7)'],
    vol: 'SUNKENKING',
    files: [
      { name: 'SUNKEN.EXE', size: '211,940', date: '02-11-97', kind: 'run', prog: 'sunken' },
      { name: 'DESIGN.TXT', size: '2,876', date: '06-03-97', kind: 'text', text:
`THE SUNKEN KING
DESIGN DOCUMENT v0.4
by Mags & Priya
-----------------------------

STORY: The Sunken King rose out of the sea and took the Tide Bell. Without the bell the tide doesn't know when to turn. You have to get it back.

CHAPTERS:
1. The Shore ............. DONE!!
2. The Castle ............ Priya is writing the King's speech
3. Under the Sea ......... (Mags) need water tiles
4. The Eel Caves
5. The Bell
6. ???
7. The End (sad bit??)

MONSTERS: crab (done), eel, angry gull, the Drowned Knight, the King (3 forms!!)

-----------------------------
21 MARCH 1997

Priya moved to Leeds. Her dad got a new job. She said we'd keep doing it by email but her new house hasn't got the internet yet and the phone is really expensive in the day.

I'll do the castle myself.

-----------------------------
3 JUNE 1997

Haven't done the castle.` },
    ],
  },
  {
    id: 'hollow', year: 1998, age: 16, color: '#5a5a5a', label: ['hollow', '', "don't"],
    vol: 'NO NAME',
    files: [
      { name: 'HOLLOW.EXE', size: '29,880', date: '11-17-98', kind: 'run', prog: 'hollow' },
      { name: 'README.TXT', size: '61', date: '11-17-98', kind: 'text', text:
`don't play this one. it's not really a game.` },
      { name: 'HOLLOW.BAS', size: '3,317', date: '11-17-98', kind: 'text', code: true, text:
`' hollow
' november

SCREEN 13
day = 1

' every day there's a bit less
' in the house. that's the
' whole game.

' the door says not today
' that's it, that's the
' puzzle. there isn't one.

' haven't been to school since
' the 4th. mum keeps knocking.
' i say i'm fine. i'm fine.

' if anyone ever reads these:
' hi.` },
    ],
  },
  {
    id: 'lamp', year: 2000, age: 18, color: '#c9a227', label: ['LAMP v1.2', 'for win95/98', '2000'],
    vol: 'LAMP',
    files: [
      { name: 'LAMP.EXE', size: '388,112', date: '02-26-00', kind: 'run', prog: 'lamp' },
      { name: 'README.TXT', size: '1,904', date: '02-26-00', kind: 'text', text:
`LAMP v1.2
for Windows 95/98
by Mags Hale

Keep the ships off the rocks till morning. Point the light at a ship and it'll see the rocks and turn away. That's it.

Thanks to Dr Amis, who asked me in about October what I used to like doing. I said making games. She asked what I'd make now. I said I don't know, something with a light in it.

So.

I go on Wednesdays still. I'm doing better. Not all at once, but better.

Also thanks to the squirt, who tests everything I make, even the bad ones, and who knocked on my door when I wasn't answering it for anyone else.

Got a B in AS Computing. Applied to Glasgow.` },
    ],
  },
  {
    id: 'foryou', year: 2001, age: 19, color: '#e8e2cf', ink: '#203050', sealed: true, label: ['FOR THE', 'SQUIRT', 'open last!'],
    vol: 'FOR SQUIRT',
    files: [
      { name: 'FORYOU.EXE', size: '402,551', date: '09-14-01', kind: 'run', prog: 'foryou' },
      { name: 'KING.TXT', size: '1,180', date: '08-30-01', kind: 'text', text:
`THE KING'S SPEECH
(The Sunken King, chapter 2)
by Priya Varma, emailed from Leeds, four years late

"You came all this way for a bell.

I took it because the tide was so loud. Every day it came in and went out, came in and went out, and nobody ever asked the sea if it was tired.

I wanted one day where nothing had to turn.

But you're right. It has to turn. That's how you get back to the shore.

Take the bell. Ring it twice. Once for the tide and once for whoever's waiting for you."

-- Mags, sorry it took me so long. Finish it one day. P x` },
      { name: 'LATER.TXT', size: '330', date: '09-14-01', kind: 'text', text:
`If you're reading this in like 2020 because you found these in the attic: hello from the past.

Tell me if computers are all virtual reality yet. Tell me if you made anything.

Phone me.

M` },
    ],
  },
];
