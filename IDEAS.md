# A game a night

Game prompts for overnight builds. Each one is the 1–2 paragraph spec to paste in. Paste the **house rules** at the bottom after each one so an unattended run finishes the job the same way every time.

Each idea borrows the core of a game you like and adds one twist. The twist is spelled out in the prompt, so the build doesn't turn into a plain clone. Ideas 1–31 were the October batch; 32–61 came next. Tick an idea off here once it's been built.

### Checklist

- [x] 1. Scales — [`scales/`](scales/)
- [x] 2. Ten of Me — [`tenofme/`](tenofme/)
- [ ] 3. Moonshot
- [x] 4. Please Stay on This Page — [`staypage/`](staypage/)
- [ ] 5. Grip
- [x] 6. Horde — [`horde/`](horde/)
- [ ] 7. Lost Property
- [ ] 8. Gumball Landlord
- [ ] 9. Mirror Knight
- [ ] 10. Draw Ahead
- [ ] 11. Marco
- [ ] 12. Spire Keeper
- [ ] 13. Pop-Up
- [ ] 14. Hedges
- [ ] 15. Lantern
- [ ] 16. Pile-Up
- [ ] 17. Glyphs
- [ ] 18. Needle
- [x] 19. Ladder — [`ladder/`](ladder/)
- [ ] 20. Chat Dungeon
- [ ] 21. Moving Day
- [x] 22. Poker Squares — [`fivebyfive/`](fivebyfive/)
- [ ] 23. High Tide
- [ ] 24. Try Finger
- [ ] 25. Floodplain
- [ ] 26. Still Life
- [ ] 27. Encore
- [x] 28. Dam Day — [`damday/`](damday/)
- [ ] 29. Liar's Table
- [ ] 30. Customs of the Dead
- [ ] 31. Sonar
- [ ] 32. Snowball
- [ ] 33. Invader
- [ ] 34. Night Bus
- [x] 35. Starter — [`starter/`](starter/)
- [ ] 36. Pinball Over It
- [ ] 37. Hotline
- [ ] 38. Regulars
- [ ] 39. Crossfire
- [ ] 40. Dollhouse
- [x] 41. Shared Deck — [`harrowing/`](harrowing/)
- [ ] 42. Come Bye
- [ ] 43. Floppy
- [ ] 44. Conga
- [ ] 45. Heirloom
- [ ] 46. Panto Horse
- [ ] 47. Plonk
- [ ] 48. Jolly Cooperator
- [ ] 49. Chairlift
- [ ] 50. Moonrise Manor
- [ ] 51. Spaghetti Bridge
- [ ] 52. Are We There Yet
- [ ] 53. Puddle
- [ ] 54. Cube
- [ ] 55. Last Checkout
- [ ] 56. Conductor
- [ ] 57. Poltergeist
- [ ] 58. Unlocked
- [ ] 59. Reef
- [ ] 60. Documentary
- [ ] 61. Midnight Golf

---

## 1. Scales ✅
*Borrows: Suika Game · Twist: there's no jar, just a see-saw*

**Built 2026-10-06 as [`scales/`](scales/).**

A Suika-style merge game with no jar. Everything lands on a long plank balanced on a single pivot, like a see-saw. Two things of the same kind that touch merge into the next size up, and bigger things are heavier. The plank tilts with weight and position (a small thing far out on the end outweighs a big one near the middle), round things roll when it tilts, and anything that falls off ends the game. That makes every drop a merge decision and a balance decision at once.

Set it at an autumn farmers' market: crab apples, apples, squash and gourds up to a prize-winning giant pumpkin, on a weathered plank over a hay bale. Slow escalation keeps it interesting: the plank gets shorter as your score climbs, a gust of wind now and then, a crow that lands on one end. Soft, chunky physics that's satisfying to watch, merges that pop with a sound, a big friendly score. One-thumb friendly: drag to aim, release to drop.

## 2. Ten of Me ✅
*Borrows: Cursor\*10 (flash), Braid · Twist: the guards react to all your past selves, so an old run can be a decoy*

**Built 2026-09-30 as [`tenofme/`](tenofme/).**

A side-view heist in a museum after closing. You get ten runs of 30 seconds each, and every earlier run replays exactly alongside the current one as a faded copy of you doing precisely what you did. Pressure plates hold doors open only while someone stands on them, lasers trip when anyone crosses them, and guards chase whichever of you they spot first. Run three can be a decoy that drags a guard away from where run seven needs to be. If you change things so an old copy can't do what it did (the door it walked through is now shut), it flickers and freezes in place, which can be useful too. The goal is for any one of you to walk out of the loading dock with the jewel before the ten runs are used up.

A dozen or so hand-built floors that each teach one idea (a plate, a guard, a camera, a key only one of you can carry, a door that needs two of you at once) and then combine them. Style: flat noir silhouettes against a deep blue night palette, each copy of you a slightly different tint with its run number over its head, and a timeline strip along the bottom showing all ten runs. Keys on desktop, on-screen buttons on phones.

## 3. Moonshot
*Borrows: Worms · Twist: tiny round planetoids, each with its own gravity*

A turn-based artillery game in the spirit of Worms, set on a cluster of tiny round planetoids floating in space, each with its own gravity. Shells bend around every planetoid they pass near. A good shot slingshots around a moon and drops onto a team hiding on the far side; a bad one goes into orbit and comes back for you three turns later. The ground is destructible down to the pixel, so craters reshape the little worlds, and troops standing on a planetoid you've carved away can drift off into space.

Two teams of four little astronauts, hotseat for two players or against a CPU that shoots believably but not perfectly. A handful of weapons that fly differently: a heavy shell, a light bouncy grenade, a jetpack move, a drill that burrows through a planetoid, a gravity mine that bends nearby shots. Show a faint predicted arc for only the first stretch of the flight. Style: a saturated retro sci-fi paperback cover, grainy starfield, jaunty astronauts with silly names. Aim by dragging back from your trooper, the same on a phone.

## 4. Please Stay on This Page ✅
*Borrows: The Stanley Parable · Twist: the narrator notices what you do with the browser*

**Built 2026-09-30 as [`staypage/`](staypage/).**

A Stanley Parable-style narrative game about a very simple web page: a single button that says "Continue," and a calm narrator (typed-out on-screen text) who explains, a little too carefully, what you're supposed to do next. The game notices what you do with the browser itself and the narrator reacts, first mildly and then less so: switching tabs and coming back, resizing the window or rotating the phone, sitting idle, trying to close the tab, right-clicking, selecting the text, scrolling past the end, opening it at 3 a.m., coming back tomorrow. Those reactions branch into different paths and endings depending on how you disobey.

Aim for around ten endings that each take a few minutes to find, with an ending tracker saved in localStorage that the narrator also knows about ("You've been here before. You pressed the button last time. Why not this time?"). The page's look should change with the path: clean and corporate at first, then peeling back to reveal its own scaffolding, a broken 1998 version of itself, a page that is only a comments section. Funny and a bit melancholy, never mean to the player.

## 5. Grip
*Borrows: Getting Over It, Jump King · Twist: each thumb is one of the climber's hands*

A climbing rage game made for phones first: each of your two thumbs is one of a climber's hands. Hold a thumb down to grip, drag to reach, lift it to let go. The body swings under whichever hand is holding, and if both let go, gravity wins. On desktop, find an equivalent that feels as good (say, two keys for the hands and the mouse to reach). Falling costs you nothing but height, and it's one long continuous climb with no checkpoints, in the Foddian tradition.

One hand-authored route up a sea cliff, then a lighthouse, then a radio mast in a storm, with holds that teach things: a jug, a crimp that tires you faster, a hold that crumbles, a swinging rope, a gap you have to lunge across. Grip strength drains while you hang on one hand and recovers on two. A dry, calm narrator (on-screen text) comments on your falls now and then. Keep the art bold and simple, one chalky climber silhouette against big skies, and make the falls feel awful and funny at once. Save the highest point reached.

## 6. Horde ✅
*Borrows: Vampire Survivors · Twist: you are the horde*

**Built 2026-10-07 as [`horde/`](horde/).**

A reverse Vampire Survivors. A single hero stands in a field auto-attacking with a growing arsenal of whips, orbiting books, garlic auras and lightning, and you are the horde. You spend a trickle of essence to spawn monsters at the edges of the screen and steer them with a rally flag. Every monster that touches the hero chips its health; every monster the hero kills gives it XP, which it spends on upgrades (the familiar level-up cards, picked by the hero itself). Kill the hero before it maxes out and becomes unstoppable.

Between rounds you unlock monster types with different jobs: cheap swarmers, tanky brutes, things that explode, bats that dodge, a healer, a shield-bearer. Each round's hero is a different character with a build path you can learn to counter. Hundreds of enemies on screen at once should stay smooth. Style: crisp, gothic, top-down 16-bit fantasy with the genre's satisfying damage numbers and gem pops. A round lasts five minutes.

## 7. Lost Property
*Borrows: Her Story · Twist: the database is a lost-property ledger*

A Her Story-style mystery told entirely through a search box. You're the new clerk at a seaside town's lost-property office, and you've inherited the old terminal: about 250 ledger entries spanning 40 years (the item, where it was found, who handed it in, who collected it, and a clerk's note). Type any word and you see only the first five matching entries, in date order. Hidden across the entries is a story (someone kept losing things on purpose, and the clerks noticed), and you piece it together by following names, places and odd items from one search to the next.

Write the entries so the story can be found in any order, and so the clerks themselves change over the years: their habits, their jokes, their notes to each other. There's no win screen until you type the right name into a final "Who?" field, followed by a quiet ending. Style: a green-phosphor CRT terminal on a desk in a dim office, with a sticky-note pad at the side where you can pin entries and jot notes, saved between visits.

## 8. Gumball Landlord
*Borrows: Luck be a Landlord · Twist: the slot machine is a physics gumball machine*

A Luck be a Landlord-style roguelite, but the slot machine is a big glass gumball machine. Each turn you crank it and a handful of gumballs rattle out, with real physics, into a tray below. Each gumball is a symbol (coin, cherry, cat, bee, flower, bomb, thief…) and scores both by itself and from whatever it's touching when it settles. After every crank you pick one new gumball out of three to add to the machine, and every few cranks the landlord comes for rent, which keeps going up.

The physics is the fun: combos from gumballs landing together, a magnet that pulls coins toward it, a bomb that clears its neighbours, a cat that eats any fish it touches, a paid nudge that tilts the tray. Aim for about 40 symbols with interactions you can learn, and runs of about 20 minutes. Style: glossy candy colours, a chrome and red-enamel machine, rattly clacky sound effects and number pops.

## 9. Mirror Knight
*Borrows: Elden Ring bosses · Twist: the boss learns from you*

A single Elden Ring-style boss fight, top-down: you against the Mirror Knight in a round arena. Before each attempt you pick a weapon (straight sword, greatsword, spear, bow, or a sacred seal with a spell), then fight with light and heavy attacks, a dodge, stamina and a few flasks. The twist: the knight learns from you. After each attempt it takes up the weapon you used last time and copies your habits. If you always dodged left and attacked twice, it starts doing that too. Beating it means keeping it guessing, which means changing how you play.

Show the learning honestly: a quiet "the Mirror Knight has learned…" line after each death, and a small crack in its armour for each habit it has picked up. Three phases, with a final phase that uses everything it knows. Style: stark black and white with one accent colour per weapon, crisp animation that reads at phone size, a big named health bar across the bottom and a proper YOU DIED. Keyboard and mouse on desktop; a stick and buttons on phones.

## 10. Draw Ahead
*Borrows: Line Rider · Twist: the sled is already moving, and you draw the track just ahead of it*

Line Rider, except the sled is already moving. A little rider starts sliding the moment you begin, and you draw the track in front of it in real time with your finger or mouse, faster than it can catch up. Steep lines speed it up and gentle ones slow it down, loops and jumps work if you draw them right, and running off the end of your line means a tumble. Ink is limited and refills slowly, and the track behind the rider fades away.

The world scrolls with the rider over things you have to get past: rocks to jump, gaps, gates to thread for points, wind that pushes the rider around. Score is distance plus style (air time, loops, near misses). It's an endless run that ramps up, with a daily seeded course to beat your best on. Style: the Line Rider look (white paper, blue pencil line, stick rider on a red sled) plus the odd pencil doodle in the margins.

## 11. Marco
*Borrows: Big Walk · Twist: you find your friend by sound alone, in fog*

A first-person walk across a foggy moor to find a friend by sound. You got separated on a hike, and the fog is too thick to see more than a few metres. Hold a button to call out, and your friend calls back from somewhere out there with the two-note hoot you agreed on (synthesized, with subtitles for what they actually say), placed in 3D audio. But the hills echo, the wind carries voices, streams drown them out, and your friend moves too, sometimes toward you and sometimes the wrong way. Along the way you find more tools: a whistle that carries further, a torch whose light glows through the fog, a flare.

Five or six short chapters across different ground (heather moor, a stone circle, a ruined farm, a river valley, the ridge at dusk), each with a small puzzle, like guiding your friend across the river by calling directions from a tower. Tender and funny, with replies full of personality. Style: soft, realistic three.js fog and grass, first person with no visible body. Best with headphones.

## 12. Spire Keeper
*Borrows: Slay the Spire, streamer culture · Twist: you build the Spire, and you're scored on drama*

You're the keeper of a Spire, and a hero with a Slay the Spire-style deck, HP and relics is about to climb it live on stream. Before each floor you choose which enemy they fight, which relic sits in the treasure room and which event they walk into, then watch the fight play out automatically, card by card. You don't want the hero to die, and you don't want them to cruise. The hype meter climbs when they're in real danger and pull through, and drains when fights are dull or one-sided. A death ends the stream; reaching the top on 1 HP is a legendary broadcast.

Give the hero a readable AI that plays sensibly but has habits you can learn and exploit, plus a pool of about 30 cards, 15 enemies and 15 relics, so you can reason about how a fight will go. A fake stream chat scrolls beside the fight and reacts to it ("it's over", "WE'RE SO BACK", a flood of emotes at a clutch block). Style: chunky hand-drawn cards and monsters in a dark stone tower, with a stream overlay in the corner. A run is about 15 floors and 15 minutes.

## 13. Pop-Up
*Borrows: WarioWare, 2000s web nostalgia · Twist: every microgame happens on a cluttered 2003 desktop*

A WarioWare-style run of 3-to-5-second microgames, all set on a cluttered early-2000s desktop (think XP). Each one is a single frantic instruction: CLOSE IT (the real pop-up among ten fakes), PUNCH (the monkey in the banner ad), DEFRAG (sort the coloured blocks), DIAL IN (match the modem's squeal), CLEAR COOKIES (actual cookies), DRAG (the paperclip assistant off screen), SAVE (before the blue screen). They get faster and faster, with four lives and a boss game every 15 rounds.

Around 25 microgames that each explain themselves in one word and one image, plus a few that mess with the fake desktop itself: the start menu, the recycle bin, a screensaver kicking in mid-game. Style: early-2000s desktop kitsch (glossy blue taskbar, chunky icons, MIDI bleeps, a green-hill wallpaper) with WarioWare's bold instruction text slammed across it. Everything works with one finger or the mouse.

## 14. Hedges
*Borrows: The Witness · Twist: every solved line becomes a hedge that shapes the other puzzles*

A Witness-style line puzzle game set in a formal garden seen from above. Each puzzle is a panel on a grid (draw a line from the start circle to the exit), with symbols the game never explains, only teaches through a sequence of panels: separate the black and white stones, pass through every dot, enclose the shapes. The twist is that all the panels share one big garden grid, and every solved line is planted as a permanent hedge. Hedges from solved panels become walls in the panels that overlap them, so the order you solve in matters. Some panels can only be solved after others have shaped the ground for them, and some get ruined if you solve their neighbours first.

Around 50 panels across four or five garden rooms, each room introducing one symbol and then mixing it with the earlier ones, and a final panel that is the whole garden. A fountain lets you undo your last hedge so you can't soft-lock. Style: a crisp top-down formal garden (gravel paths, clipped yew, stone urns), lines that glow as you draw, soft wind and birdsong. No words anywhere.

## 15. Lantern
*Borrows: Elden Ring Nightreign · Twist: you carry the shrinking circle*

A compressed Nightreign: a top-down action roguelite where the safe zone is your lantern. Outside its circle of light, the Night hurts you. The lantern's oil burns down steadily and the circle shrinks with it. Each run is two "days" of about four minutes each. You race across a small, procedurally arranged map of ruins, camps and churches, clearing enemies for runes, weapons and oil, and when the oil runs out, night falls and you fight a boss in whatever light you have left. Survive both days and you face the final Nightlord.

Keep the combat readable and weighty in the Souls tradition: light attack, heavy attack, a dodge roll with invincibility frames, stamina, a few healing flasks refilled at sites of grace, and bosses with clearly telegraphed moves. Each weapon you find carries one passive. Between runs, unlock two more characters with different abilities and a short ultimate. Style: a dark, desaturated, painterly map where the lantern light is warm gold and everything outside it is cold blue-black. Twin-stick on desktop (WASD and mouse), virtual sticks on phones.

## 16. Pile-Up
*Borrows: Learn to Fly, Toss the Turtle · Twist: every wreck stays where it landed and becomes terrain*

A launch-and-upgrade game like Learn to Fly: fling a hapless penguin off a ramp as far as you can, earn money by distance, and spend it on better ramps, rockets, gliders and bounce pads. The twist is that nothing you launch ever goes away. Every crashed penguin, broken glider and burnt-out rocket stays exactly where it landed and piles up across the landscape as permanent terrain. Your failures become the ramps, bumpers and slides that carry later launches further, and sometimes the heap you built gets in your way.

One launch per in-game day, and the goal is to cross 20 km of tundra to the ocean. The landscape should have features that matter (a crevasse, a ski jump, an ice shelf, a seal colony that bounces you) and a strip map at the top showing all your past wrecks. Style: clean flat-vector winter illustration, a jaunty soundtrack, crunchy impacts, slow motion on the big bounces. One tap to launch; drag to steer in flight.

## 17. Glyphs
*Borrows: Chants of Sennaar, Tunic · Twist: you learn a whole language from one small town's daily life*

A language-deciphering puzzle game in the style of Chants of Sennaar. You arrive in a small walled town where nobody speaks your language; everyone speaks and writes in a glyph script, from conversations to shop signs. You keep a notebook where you can write your guess of each glyph's meaning beside it. Once you've seen a glyph in a few contexts, a journal page of drawings lets you confirm three or four at once by matching them to pictures, and if they're all right, they lock in and get translated everywhere.

About 40 glyphs with a simple grammar (plurals, negation, a question marker), learned through the town's life: a baker, a guard who won't let you through the gate, a child playing a counting game, a priest's prayer. Understanding is how you progress. The gate opens when you can tell the guard the right thing by choosing glyphs. Style: flat, sun-bleached, near-isometric illustration in terracotta and teal, with calm ambient music. About 45 minutes long.

## 18. Needle
*Borrows: tower defense · Twist: the battlefield is a spinning vinyl record, and towers fire on the beat*

A tower defense played on a turntable. Enemies march along the groove of a spinning record, spiralling slowly in toward the label, while your towers sit still on the plinth around the edge and on a few bridges across the record. The record carries every enemy past every tower once per revolution, so a creep you missed comes back round. The tone arm plays a real little song, generated with WebAudio, and the towers fire on its beats: some on every beat, some on the off-beat, some only on the snare. The soundtrack is the rhythm of your defence.

Levels are records at different speeds (33, 45, 78) and in different genres, with scratches that knock enemies across grooves and warps that make them skip. Between waves you place and upgrade towers, and you can nudge the pitch slider to change the tempo, trading fire rate for how fast enemies move. Style: glossy black vinyl under warm light, towers as little brass jukebox gadgets, and a record sleeve for each level. Drag to place on phones.

## 19. Ladder
*Borrows: Getting Over It, Baby Steps · Twist: your only tool is a ladder you have to haul up after you*

A Foddian climbing game where your only tool is a long wooden ladder. You're a small painter at the foot of a teetering heap of junk (cars, fridges, pianos, scaffolding) with a can of paint to deliver to the very top. You can't jump or climb walls. You lean the ladder against something, climb it rung by rung, then from the top haul it up behind you and set it again. The ladder is fully physical: it slips on smooth surfaces, rocks if you climb too fast, and sometimes catches you when things go wrong. A bad placement can drop you most of the way down.

One continuous hand-built route with no checkpoints, about an hour to the top for a good player. Controls should be learnable in ten seconds and work with one finger on a phone. Save your high point, and at the end of each session show a replay of your worst fall with a deadpan sports-commentator caption, for streamers to clip. Style: a hazy, sun-faded 2D side view with a light painterly touch, and a painter whose gentle little animations make every fall sadder.

## 20. Chat Dungeon
*Borrows: Twitch-integrated games · Twist: the stream's chat is the dungeon master*

A roguelite made to be played on a Twitch stream, where chat is the dungeon master. The streamer plays a short top-down dungeon crawl (rooms, enemies, loot, a boss on floor 5), and chat changes the game as it goes by typing commands: !spawn goblin, !trap, !bless, !curse, !vote left or right at forks. Chat earns a shared pool of mischief over time and every command spends some of it. Anything a chatter spawns wears their username, so the streamer knows who to blame. Connect read-only to a channel's chat from the title screen using Twitch's anonymous IRC websocket, so there's no login or backend; if that's no longer possible, say so and lean on the simulated chat.

It must be fully playable alone too: with no channel set, a simulated chat of fake users does the same things, each with a personality (the one who always spams !curse, the kind one who blesses). Keep the layout clean enough to capture in OBS, with a readable chat feed and big names. Style: a punchy, bright dungeon crawler with chunky outlines and big hit effects, easy to read on a stream at 720p.

## 21. Moving Day
*Borrows: Superliminal · Twist: forced perspective, but the job is getting everything into the moving van*

A first-person forced-perspective puzzle game set on moving day. You have to get everything out of a small apartment and into the moving van, but the couch won't fit through the door, the piano won't go down the stairs, and the van is tiny. When you pick something up, it stays the same size on screen as you move your view. Set it down against something far away and it becomes enormous; set it on the floor right in front of you and it's tiny. Shrink the fridge to fit it through the cat flap, grow a shoebox into a bridge over a gap, stack giant books to reach a high window.

Six or seven spaces (the bedroom, the kitchen, the stairwell, the street, and the van itself, which is a puzzle about fitting everything in), then a closing scene in the new place. Warm and a little dreamlike, with the apartment getting stranger as you go. Style: soft, realistic lighting and cosy clutter in three.js, first person with no body, just the thing you're carrying. Pointer lock and click to grab on desktop; drag to look and a grab button on phones.

## 22. Poker Squares ✅
*Borrows: Balatro · Twist: poker hands on a 5×5 grid, where every row, column and diagonal scores at once*

**Built 2026-10-08 as [`fivebyfive/`](fivebyfive/) (Five by Five).**

A Balatro-style roguelite built on Poker Squares, the old solitaire. You place cards one at a time anywhere on a 5×5 grid. When the grid is full, every row, column and both diagonals score as poker hands at once (a pair, a flush, a full house…), so one card can be part of four hands. Each round has a target score like Balatro's blinds, and between rounds you shop for jokers that bend the rules (diagonals score double, face cards are wild in columns, straights can wrap around), card enhancements, and board modifications: a square that multiplies, a square you can't use, a square that keeps its card into the next round.

Keep the scoring spectacle: each hand lights up in turn with chips and mult ticking up and a crunchy sound, then the total slams onto the screen. A run is about eight antes, each ending in a boss round that twists a rule. Style: green felt under a warm lamp with a jaunty, slightly unhinged card-room vibe. Tap to place, with a clear preview of what each square would make.

## 23. High Tide
*Borrows: Defend Your Castle (flash), falling-sand games · Twist: the tide actually erodes what you build, grain by grain*

A Defend Your Castle-style game at the beach: you guard a sandcastle through one long summer day. Crabs, seagulls, dogs, kids with buckets and a man with a metal detector come for it, and you fend them off by picking them up and flinging them with your finger or mouse (the kids you set down gently somewhere else). Between waves you spend shells you've collected to build: dig a moat, raise walls, add towers, set down a bucket of water the seagulls won't cross.

The sand is a simple falling-sand simulation, so walls slump when wet, moats silt up, and the tide, which comes in a little further every wave, really erodes what you built, grain by grain. The day ends at sunset with the tide at its highest, and whatever castle is left is your score. Style: a bright, warm side-view beach in chunky pixel art, with sun sparkle on the water and gentle surf in the soundtrack.

## 24. Try Finger
*Borrows: Elden Ring's player messages · Twist: working out which messages are lies is the puzzle*

A short, tough, side-view souls-like descent into a ruined castle, where the ground is covered in glowing messages supposedly left by other players, written in Elden Ring's message grammar ("Try jumping," "Hidden path ahead," "Be wary of right," "Treasure," "Liar ahead") with a rating count beside each. Some are honest and some are trolls. The invisible bridge really is there; the "treasure" is a drop into a pit; the "hidden path" is a mimic. Troll messages follow patterns you can learn if you pay attention, just like the fake players who wrote them.

When you die, you can leave one message of your own in the same grammar. It persists in localStorage for your next attempt, along with a bloodstain that replays how you died. About 10–15 minutes to the bottom for a practised player, with two or three bosses. Style: muted grey-gold ink wash with the orange glow of messages, and plenty of dry humour in the fake player names.

## 25. Floodplain
*Borrows: Into the Breach · Twist: you're the river, not the army*

An Into the Breach-style tactics puzzle where you command the river, not the army. Each level is a small grid valley with a village and a raiding party marching on it, and your tools are the water: raise or lower a sluice, breach a bank, freeze a stretch into ice, call rain on a tile, send a surge down a channel. Water flows downhill tile by tile on a simple, readable rule. A surge can sweep raiders into the lake, turn a field to mud they can't cross, or, if you're careless, flood the village you're protecting.

Everything is perfect information: the raiders show exactly where they'll move and strike next turn, as in Into the Breach, and you win a level by getting through a few turns with the village standing. About twenty levels across a year of seasons (spring melt, summer drought, autumn storms, winter ice), each season adding one tool. Style: a small, hand-painted isometric diorama, soft and clay-textured, with water that ripples and floods convincingly.

## 26. Still Life
*Borrows: The Case of the Golden Idol, Return of the Obra Dinn · Twist: the whole crime is one frozen second at a wedding*

A Golden Idol-style deduction puzzle set in one frozen moment: a wedding reception at a lakeside hotel in 1926, stopped the second the cake hits the floor and the lights go out. You explore the frozen scene, look into guests' pockets and letters, read the seating plan, the menu and the band's setlist, and collect key words (names, objects, verbs). Then you fill in a report full of blanks (who is who, who swapped the place cards, who cut the lights and why) by dragging words into them. The game only confirms answers once you have about three blanks right, so you can't brute-force it.

Make it three or four linked scenes (earlier that day, the frozen reception, the morning after) with about 12 characters, each with a clear motive and a hidden relationship, solvable with care in about an hour. Style: bold, flat colours with thick outlines, characters caught mid-gesture, a jazz-age palette. Everything clickable at phone size.

## 27. Encore
*Borrows: Crypt of the NecroDancer · Twist: every relic adds an instrument to the song, and each instrument is a power*

A rhythm roguelike where you move on the beat through a small dungeon, like Crypt of the NecroDancer, but the music is yours. You start with just a kick drum, and every relic you find adds an instrument to the song: a bassline, hi-hats, a lead synth, a choir. Each instrument gives you a power that fires on that part's rhythm (the bass knocks enemies back, the hats let you dash, the lead shoots), and enemies work the same way: each type moves to one part of the music, so you can read the room by listening. Take a hit and you lose the most recent instrument.

Five floors and a final boss that is a whole band. Everything is synthesized with WebAudio so the song changes live, in time, as instruments come and go. Style: neon club lighting on a dark tiled floor that pulses on the beat, with chunky, readable sprites. Arrow keys or swipes to move, a forgiving timing window, and a visible beat bar along the bottom.

## 28. Dam Day ✅
*Borrows: Outer Wilds · Twist: a four-minute loop in one small town, and knowledge is the only thing you keep*

**Built 2026-09-30 as [`damday/`](damday/).**

A tiny Outer Wilds: a time loop of about four minutes in a small valley town on the morning the dam upstream breaks. Every loop starts with you waking on a bench at the station and ends with the wall of water. Nothing you carry or change survives, only what you've learned. Walk around (side view), talk to people, read notices and diaries, notice who's where at what minute. Your notebook fills itself in with threads of clues as rumours ("The engineer's keys are with the mayor's cat," "Why doesn't the siren work?"). The way through isn't an item; it's knowing exactly where to be and what to say.

Hand-build a town of about ten places and eight people, each with their own four-minute schedule, and a satisfying final loop where you use everything you know to save everyone. A clock in the corner, and a groan from the dam as time runs out. Style: gentle, sunny pastel pixel art with lots of small animated life (washing on lines, a fisherman, a church bell), which makes the end of each loop hurt.

## 29. Liar's Table
*Borrows: Liar's Bar, Buckshot Roulette · Twist: the opponents have tells, and they learn yours*

Liar's dice against three strange AI opponents in a smoky back room. Everyone rolls five dice under a cup, and players take turns raising the bid ("four 3s") or calling the last bidder a liar. Whoever's wrong loses a die, and the last player with dice wins. The twist is that the opponents have tells. Each has habits (one taps a finger when bluffing, one bids faster with a weak hand, one glances at a particular die) that you can learn to read. The tells aren't perfect, and the opponents are learning to read yours from your bidding patterns too.

Make the opponents vivid characters with lines and small animations (a lizard in a waistcoat, an old ship's captain, a nervous clown), and a tournament of a few tables with tougher opponents at each. Tension matters more than anything: the slow lift of a cup on a call, the swinging table lamp. Style: a dim, warm three.js scene from your seat at the table, candlelight and smoke. Tap to bid on phones.

## 30. Customs of the Dead
*Borrows: Papers, Please · Twist: you're the border officer at the gate to the afterlife*

Papers, Please at the gate to the afterlife. You're a customs clerk in a cramped booth between this world and the next, and every day a queue of the newly dead walks up with their paperwork: a death certificate, a record of deeds, an itinerary, sometimes a letter from a relative. Stamp them through to the right destination or send them back, while the regulations change daily ("No souls who died before their appointment," "Cats need a separate form," "Ghosts of the living are not permitted"). Catching discrepancies pays; mistakes are docked from your wages, and your family back on earth depends on those wages, which is somehow worse when you're already dead.

Spread a small story over ten days: a soul who keeps coming back, a smuggler, a bribe, a supervisor with an agenda, and a few endings. Keep the interface tactile: papers you drag across the desk, a rulebook you cross-reference by clicking two matching details, a big satisfying stamp. Style: a muted, Soviet-poster-meets-Día-de-Muertos palette in chunky pixel art, with the booth window looking out on the queue of souls.

## 31. Sonar
*Borrows: Iron Lung · Twist: you can only see by pinging, and something else can hear you*

*Note: [Echo](echo/) (built 2026-10-01) already does seeing by sound pulses. To keep Sonar distinct, lean on the chart navigation, the slow photographs and the thing that hunts your ping.*

A small submarine horror game. You're sealed inside a cramped sub with no window at the bottom of a sea no one has mapped. All you have is a chart with your coordinates and a handful of marked points, dials for heading and thrust, a camera that takes one grainy black-and-white photo at a time (and takes a while to develop), and a sonar ping that shows the shapes around you for a moment, which something else can also hear. Navigate to each point, photograph what's there, and get home.

The fear should come from what you can't see: the hull creaking, the thud of something against it, a sonar return that's too big and not where it was on the last ping. Keep the interior detailed and claustrophobic, and make the photos unsettling but ambiguous. One run is about 20 minutes, with a proper ending. Style: rusted, amber-lit controls in three.js from a fixed seat, CRT fuzz on the monitors, and a deep, humming sound design built in WebAudio. Best with headphones.

---

# More ideas (32–61)

## 32. Snowball
*Borrows: Katamari Damacy · Twist: you're a snowball, and the only way is down*

A Katamari Damacy game where you're a snowball rolling down a mountain. You start as a handful of snow at the summit and roll down, steering left and right, picking up anything smaller than you: pinecones, then skis, then snowmen, then skiers (who flail comically and stick out of you), then trees, chalets, a snowcat and eventually the ski lodge. The only direction is down, so each run is a race to get big enough, fast enough, before you reach the valley, and your final size decides how much of the town at the bottom you take with you.

The mountain has routes to choose between: forests full of small stuff, a cliff drop with a jump, a busy piste, an ice field where you can't steer. The snowball's handling changes as it grows, heavier and wider in the turns. About ten mountains with size targets, and a tally at the end of everything you picked up. Style: bright, cartoony three.js, the snowball lumpy with things sticking out of it, a chase camera behind, and a frantic, cheerful soundtrack that builds. Drag or tilt to steer on phones.

## 33. Invader
*Borrows: Elden Ring invasions, Hidden in Plain Sight · Twist: you're disguised as one of the enemies, and the host is watching for whoever acts wrong*

You're an invader in another player's world, disguised as one of the dozens of shambling soldiers who patrol it. The host (an AI player) is working through the area, killing enemies as they go, and watching for the one that doesn't act like the others: walking slightly off its route, standing still too long, turning to look at them. Your goal is to get close enough to backstab the host without being spotted. If they spot you, it's a straight duel you'll probably lose.

The soldiers have readable routines (patrol loops, idle animations, a gesture they all make when a bell rings), and blending in means copying them while edging into position. Each level is a different area with a different crowd (a graveyard of the dead, a market of hunched merchants, a cathedral choir) and a host with different habits of suspicion, shown as a subtle eye icon over their head. Style: top-down, moody dark fantasy, with the host's torchlight cutting through the crowd. On phones, tap to walk and hold to copy whatever the crowd is doing.

## 34. Night Bus
*Borrows: The Exit 8 · Twist: it's the last bus home, and you ring the bell when something's wrong*

An anomaly-spotting game like The Exit 8, on a night bus. You're riding home on the last bus, in the same seat, and the same stretch of route keeps repeating: the same passengers, the same ads, the same shops sliding past the windows. If nothing is different, stay on and wait for the next stop. If anything has changed (a passenger whose eyes were closed now has them open, an ad with one word altered, a shop sign mirrored, the driver gone, one person too many), ring the bell and get off. Get it right eight times in a row and you reach your stop; one mistake and you're back at the start of the line.

About 30 anomalies, from subtle to deeply wrong, and a few that only show if you look in the right place at the right moment (out the back window, at your reflection in the glass). Eerie rather than gory, with dread built from stillness and sound. Style: realistic three.js interior under sickly bus lighting, rain on the windows, the city passing outside; first person from your seat with no body. Look around by dragging or with the mouse.

## 35. Starter ✅
*Borrows: Universal Paperclips, Cookie Clicker · Twist: you're a sourdough starter with ambitions*

An incremental game where you are a sourdough starter in a jar on someone's kitchen counter. Click to bubble; bubbling gets the baker to feed you; feeding makes you grow. Soon you're unlocking upgrades like "a pleasing tang," "shared with the neighbours" and "a bakery," then "a sourdough craze," "the town's water supply" and things far stranger. In the spirit of Universal Paperclips, the scope expands absurdly and the interface itself changes with each new phase.

About an hour to an ending, balanced so it never stalls, with three or four distinct phases (the kitchen, the town, the world, beyond) that each add a new resource and a new way of thinking. Funny and slightly unsettling. Save progress and count growth while the tab is closed. Style: a minimal, typographic interface that starts as a small jar drawing on a cream background and grows into increasingly ornate dashboards.

## 36. Pinball Over It
*Borrows: Getting Over It, Jump King, pinball · Twist: a tower of pinball tables, and draining drops you to the table below*

A Foddian pinball game. Pinball tables are stacked one on top of another, and the only way up is to shoot the ball through the gate at the top of a table into the bottom of the one above. Drain on any table and the game doesn't end: the ball falls into the table below, and keeps falling until a flipper catches it. One ball, no lives, no checkpoints, and a long way up: maybe 15 tables, each with its own theme and its own nasty trick (a narrow ramp to the gate, a spinner that kills your speed, a gate that moves, a table that tilts, a bumper cluster that flings you back down).

Proper pinball feel matters more than anything: weighty flippers with a little give, a nudge with a tilt warning, satisfying lights and sounds. Two flipper keys on desktop; the left and right halves of the screen on a phone. Save the highest table reached and keep a running total of height fallen. Style: each table a distinct 1990s arcade playfield (space, haunted house, circus, deep sea) with glossy art, and a dot-matrix display at the top that taunts you.

## 37. Hotline
*Borrows: Keep Talking and Nobody Explodes · Twist: the manual is a binder of contradictory memos from engineers who disagreed*

A co-op game for two people and two screens. One player has the machine: a 1970s mainframe in a basement that's about to do something terrible, with panels of switches, dials, punch cards, blinking lights and a teletype printing error codes. The other has the manual, opened at a separate URL on their own device, and can't see the machine, so they have to talk it through. The twist is that the manual is a mess: a binder of memos from engineers who disagreed with each other ("IGNORE BRENDA'S PROCEDURE ON P.4 — it's wrong since the 1974 upgrade"), and working out which instructions apply is part of the puzzle.

Each session comes from a short seed code that both players type in, so the manual and the machine match with no backend. About eight kinds of module, a few minutes on the clock, and harder levels that add modules and more contradictory memos. Style: the machine in chunky, tactile three.js with satisfying clacks; the manual as typewritten pages with coffee rings, margin scribbles and sticky notes.

## 38. Regulars
*Borrows: Papa's Pizzeria, Coffee Talk · Twist: you serve the same six regulars for twenty years, and their orders tell their lives*

A time-management diner game in the spirit of Papa's Pizzeria: take the order, make it (pour, flip, plate, toast, all tactile little steps) and serve it before the customer gets impatient. The twist is that each day is a year, and the diner has the same six regulars for twenty years. Their orders change with their lives: the kid's chocolate milk becomes black coffee before an exam, a couple's two slices of pie become one, then two again plus a high chair, an old man's order gets simpler until one day he stops coming. You learn who they are from what they ask for and the snatches of conversation at the counter.

Rush hours stay fun as a game, with the regulars mixed in among passing strangers, and remembering a regular's "usual" earns a bonus. The diner changes with the years too (prices, the jukebox, the menu board, a renovation). Twenty short days, about 40 minutes in all, with an ending that might make someone tear up. Style: warm, flat mid-century illustration, the chrome counter seen from behind, and soft jazz that changes with the decades.

## 39. Crossfire
*Borrows: Worms, Frozen Synapse · Twist: both teams' turns happen at once, and shells can collide in the air*

A Worms-style artillery game where both teams take their turns at the same time. Each round, both sides secretly aim, pick a weapon and plan a move, then everything plays out at once. Shells fly together, can meet and burst in mid-air, and land on ground that the other side's shot blew away a moment earlier. Predicting where the enemy will be when your shell arrives, and where their shot is headed, is the whole game. A short replay shows each turn's collisions from a dramatic angle.

Destructible terrain, wind, two teams of three, a CPU opponent with a few personalities (cautious, reckless, sneaky), and hotseat for two on one device with a pass screen between them. Weapons that make the simultaneity interesting: a shield bubble that pops one incoming shell, a flare that reveals where the enemy aimed last turn, a decoy, a slow mortar that lands next round. Style: a hand-inked newspaper comic, crosshatched and two-colour, with sound-effect lettering (KA-BLAM) for impacts.

## 40. Dollhouse
*Borrows: Hollow Knight, Metroid · Twist: the whole metroidvania is one screen, and it's a dollhouse*

A metroidvania that fits on a single screen. The whole world is a big Victorian dollhouse seen from its open side, and you're a tiny wind-up tin soldier who starts in the attic. Everything is visible from the start (the kitchen, the nursery, the cellar, the grandfather clock in the hall, the garden out back), but you can't get to most of it yet. Each ability you find opens new ways through the same rooms: a key that winds you up for a dash, a paper umbrella to float, magnet boots for the iron stove, a shrinking spell for mouse holes, a music box that wakes the other toys. Bosses include the jack-in-the-box, the cat and the vacuum cleaner.

The house is one detailed illustration that changes as you explore (lamps coming on, doors swinging open, toys moving to new places), with a camera that follows the soldier closely but can pull back to the whole house at any time. About an hour to 100%. Style: a warm, hand-painted dollhouse with patterned wallpaper, tiny furniture and gaslight, and a ticking clockwork soundtrack. Keys on desktop; a stick and buttons on phones.

## 41. Shared Deck ✅
*Borrows: Slay the Spire · Twist: you and the monster draw from the same deck*

A Slay the Spire-style roguelite deckbuilder where every fight is played from one shared deck: you and the monster take turns drawing from the same pile. The monster's own cards (fireballs, curses, summons) are shuffled in at the start of each fight, and every card you add to your deck can be drawn and played by any monster you meet later. Deckbuilding becomes double-edged. A big attack card is great until a boss draws it, so the best cards are the ones only you can use well: cards that scale with your relics, your class's keyword or your discard pile.

Climb a three-act map in the usual way (fights, elites, events, rests, shops) to a final boss, with a few characters, around 60 cards and 20 relics, and monsters whose cards make you think about what you've let into the deck. Show clearly whose turn it is and who drew what. Style: hand-inked, two-tone illustration like an old printed card game on a dark blue table, with lots of satisfying card motion. Tap or drag to play.

## 42. Come Bye
*Borrows: sheepdog trials · Twist: a real flock with real flocking, steered only through your dog*

A sheepdog trial game. You steer the dog by dragging where it should run, and a small flock of sheep with real flocking behaviour (they bunch up, flee the dog, follow each other, a stubborn few break away) has to be gathered and guided around the course. Fetch them down the field, drive them through a pair of gates, split a few off in the shedding ring and pen them at the end, all against the clock. Come in too close and they scatter; hang back and they drift. It's calm, readable and surprisingly tense.

A season of trials across different fields (a hillside, a field with a stream, a windy moor, a foggy morning) with different flocks (nervous lambs, an old ram who won't be hurried), judges who score each phase as at a real trial, and a dog whose trust in you grows. Style: soft, painterly British countryside with drystone walls and long shadows, sheep like funny little cotton balls, and the whistle calls of real commands ("come bye," "away to me").

## 43. Floppy
*Borrows: The Beginner's Guide, The Stanley Parable · Twist: a big sibling's homemade games from 1992 to 2001, found in a shoebox*

A narrative game told through the little games someone made as a kid. You've found a shoebox of floppy disks in your parents' attic: games your older sibling made between the ages of 10 and 19, from 1992 to 2001. Put a disk in the old PC and you play it: a guess-the-number game in QBasic, a text adventure about the family dog, a maze, a racing game with a broken lap counter, an unfinished RPG, something strange and sad. Between and around the games, your sibling's notes (disk labels, README files, comments in code you can open) tell you what was going on in their life when they made each one.

About eight tiny games, each clearly by the same person getting better and growing up, with flaws you can see, and an ending when you load the last disk. Not a twist ending for its own sake: an honest, kind one. Style: an emulated DOS-to-Windows 98 PC on a desk in an attic, each game in its era's look (text mode, CGA, VGA), with disk-drive clunks and fan hum.

## 44. Conga
*Borrows: Snake, Super Auto Pets · Twist: your army is a conga line you steer*

Snake meets Super Auto Pets. You steer the head of a dancing conga line around an arena, and every recruit you pick up joins at the tail. Recruits are animals with abilities that depend on their place in the line: a tortoise at the back shields everyone, a bee near the front stings, a parrot copies whoever's ahead of it. When your line touches an enemy conga line, the two dancers who touch fight, and abilities chain down both lines. Cross your own tail and you trip over yourself.

Each round is a short arena with enemy lines, recruits to pick up and coins. Between rounds, a shop lets you buy, swap and combine animals and rearrange the order. Five rounds and a boss line that's an entire carnival parade. Style: bright, flat and festive, with confetti, maracas on every beat and a Latin dance soundtrack that speeds up as your line gets longer. Swipe or drag to steer on phones; keys on desktop.

## 45. Heirloom
*Borrows: The Room · Twist: the puzzle box was added to by four generations, and holds their secrets*

A tactile three.js puzzle box in the manner of The Room. An old wooden box inherited from a great-grandmother sits on a table under a lamp, and you turn it in your hands, slide panels, press inlays, wind a key and look through a lens, where every mechanism opens onto another. The twist is that each generation of the family that owned it added to it, so each layer comes from a different decade in a different maker's style (Victorian brass and wood, 1940s Bakelite, a 1970s cassette, a 2000s flip phone wedged in a compartment), and each holds part of a family story the box was built to keep.

About five layers and an hour of play, with a hint that gets more specific the longer you're stuck. Everything works with natural gestures (drag to turn the box, pinch to look closer, drag to slide or rotate a part), and every click and grind should sound wonderfully mechanical. Style: photoreal wood, brass and leather under a warm lamp, with a shallow depth of field.

## 46. Panto Horse
*Borrows: QWOP, Baby Steps · Twist: you're both halves of a pantomime horse*

A QWOP-style physics comedy where you play both halves of a pantomime horse costume: the front person (head and front legs) and the back person (back legs, bent double, can't see a thing). On a phone, each thumb runs one half; on desktop, two sets of keys. Each half walks its own pair of legs, and the costume between them pulls, stretches and tears if they get out of step. Get through a steeplechase, a dressage test, a village parade and finally the big race.

Ragdoll physics that makes failure hilarious: the halves falling in different directions, the costume splitting to show the two people inside, the crowd reacting. Short courses with checkpoints, medals for times, and a replay of the best wipeout on each course. Style: a jolly English country show with bunting, a cheap horse costume with a goofy face, and an over-excited commentator in the captions.

## 47. Plonk
*Borrows: GeoGuessr · Twist: an invented continent with consistent rules you learn as you play*

GeoGuessr for a world that doesn't exist. Each round drops you somewhere on a procedurally generated continent in a street-level view you can look around, and you place a pin on the map where you think you are. The continent has consistent rules you pick up the way a real GeoGuessr player learns bollards and road lines: three or four countries, each with its own script on signs, road markings, roof shapes, side of the road and style of telegraph pole; biomes that follow latitude and altitude; a foggy coast and a desert in the rain shadow of a mountain range.

You collect a postcard from each country that hints at one or two clues, but most of the learning should be the player noticing things. Five rounds a game, scored by distance, with a daily seed. Style: a soft, sunny, low-poly three.js world that's still richly detailed at street level (signs, cars, washing lines, letterboxes, plants), and a beautiful hand-drawn map to pin.

## 48. Jolly Cooperator
*Borrows: Elden Ring co-op · Twist: you're the summon, the host is a hapless AI player, and you can only talk in gestures*

You're a summoned spirit in an Elden Ring-style world, and your host is a well-meaning but hopeless AI player. You can fight (top-down: attack, dodge, stamina, a few spells), but a boss only counts if the host survives it. If the host dies, you're dismissed and the attempt ends. The host has a real player's bad habits: heals at the worst moment, rolls off ledges, chases loot into ambushes, spams one attack, gets greedy. You can't talk, only use the game's gestures (point, beckon, wait, bow, a celebratory spin), which the host sometimes heeds, trusting you more each time your advice pays off.

A short run through a few areas and bosses, with a different host each run (the cautious one, the berserker, the one who's only here for fashion). Escort, protect, draw aggro, revive. Funny and warm, with the host's little emotes after a win and their messages on the ground. Style: desaturated, golden-hued dark fantasy with readable silhouettes and a summoning-sign glow on you. Twin-stick on desktop, a virtual stick on phones, and gestures on a radial wheel.

## 49. Chairlift
*Borrows: Mini Metro, Mini Motorways · Twist: a ski resort, where lifts only go up and runs only go down*

A Mini Metro-style network game on a ski mountain. Lodges, car parks and hotels appear at the base and on the slopes, and skiers rated green, blue or black want to ride up and ski back down runs that suit them. You draw chairlifts, which go up in straight lines, and pistes, which can only go downhill along the terrain, and the network has to let every skier loop round. A beginner who ends up at the top of a black run takes a tumble, queues build at busy lifts, and when one overflows the day is over.

Each week brings new pieces (a longer lift, a gondola, a snowcat to groom a run, a mountain restaurant that holds skiers for a while), and the weather changes the slopes. Several mountains to unlock with different shapes, and floodlit night skiing at the end of each day. Style: clean, minimalist graphics like a classic resort trail map, crisp contour lines, little dots of skiers streaming down the pistes, and a calm ambient soundtrack.

## 50. Moonrise Manor
*Borrows: Werewolf/Mafia · Twist: you're the werewolf, and every lie you tell has to stay consistent*

A social deduction game where you're the werewolf among eight dinner guests at a remote manor, over five nights. Each night you choose a victim. Each day at dinner, the guests share what they saw ("I heard the stairs creak at midnight"), accuse each other and vote someone out. You join in by choosing what to say from a set of statements: the truth, a careful lie, an alibi, an accusation. The guests are simple but sound reasoners who remember everything said and spot contradictions, so every lie you tell is something you have to keep consistent with.

The guests are distinct characters with their own suspicions, alliances and habits (the bishop believes whatever the colonel says, the twins always vote together), and a few have secrets you can use against them. Survive five nights to win. A notebook shows what everyone has claimed so far. Style: a candlelit Victorian manor, painted portraits of the guests whose expressions change with their suspicion, and creaking, ominous sound.

## 51. Spaghetti Bridge
*Borrows: Poly Bridge · Twist: a school science fair, and you build with pasta*

A Poly Bridge-style bridge-building physics game at a school science fair, where everything is built from pasta. Spaghetti is light and strong in tension but snaps under compression, rigatoni is stiff but heavy, lasagne sheets make the deck, glue joints take time to dry, and your budget is how much pasta is in the box. Build across gaps between desks, books and lunchboxes, then the judges test it with escalating loads: a toy car, a stack of textbooks, the class hamster in its ball, a full lunch tray and finally the head teacher's bowling ball.

About 20 levels, with stress colouring on each piece under load, slow-motion snapping (pasta bits flying) when it fails, and a judges' score that rewards cheap, elegant bridges. Style: bright, chunky classroom illustration, the pasta looking tasty, a hand-lettered poster board for the menu, and a cheerful soundtrack of crunches and applause. Drag to build on phones and desktop.

## 52. Are We There Yet
*Borrows: FTL, Oregon Trail · Twist: the ship is a family station wagon on a summer road trip*

FTL meets Oregon Trail in a 1980s station wagon. A family of five is driving across the country to Grandma's, and you run the car like a starship. Assign family members to stations (driving, navigating, snacks, entertainment, keeping the kids apart), manage fuel, snacks, money, morale and the car's health, and choose the route across a map of towns, motels, diners, roadside attractions and tempting shortcuts. Events at each stop are FTL-style choices with consequences ("A hitchhiker with a guitar." "The dog is missing." "Someone wants to see the World's Largest Ball of Twine."). Breakdowns are the boss fights: a real-time scramble under the hood with everyone at a station.

A run is a trip of about 15 stops and 20 minutes, different every time, with a few families to unlock. Very funny and a bit tender. Style: a sun-faded 1980s family-photo palette, a wood-panelled car shown in cutaway with everyone in their seats, a road map with a felt-tip route, and a car radio playing era-flavoured synth tunes.

## 53. Puddle
*Borrows: cosy fishing games · Twist: you fish in the reflections in puddles, and catch what fell into the reflected world*

A small, dreamy fishing game where you fish in puddles after the rain. A city street at dusk is dotted with puddles, each reflecting the sky, the buildings and the street lamps above it, upside down and slightly wrong. Cast your line into a puddle and you're fishing in the reflection, where you can catch things that fell into the reflected world: a lost balloon, a kite, a paper boat, a pigeon (who's fine), a street lamp's glow, a cloud and eventually the moon. Each catch goes into a little illustrated logbook with a one-line note.

Simple, satisfying fishing: cast, wait, watch the bobber, hook, and reel against something that pulls in its own way. Different puddles reflect different things, and the weather and the hour change what's there, with a quiet rhythm of walking between puddles under an umbrella. About 50 catches, a few of them rare. Style: wet, glossy, soft painterly 2D with gorgeous reflections and lamplight on rain, and a mellow lo-fi soundtrack under the rain.

## 54. Cube
*Borrows: Zelda dungeons, Rubik's Cube · Twist: the dungeon is a 3×3×3 cube of rooms you rotate*

A Zelda-like dungeon where the whole dungeon is a 3×3×3 cube of rooms, and you can rotate any layer of it like a Rubik's Cube. Rotating a layer turns those nine rooms, and everything in them, so doors that led nowhere now open onto another room, a corridor ends up on its side so its pit becomes a ladder, or a flooded room pours into the one below. Inside the rooms you play top-down: walk, push blocks, pick up keys, fight a few simple enemies. Find the treasure in the centre room and get out.

Three or four dungeons of increasing complexity. A 3D view of the cube shows which room you're in and what's around it, with a clear animation when a layer turns (you included, if you're in it). Layers can only be turned from control rooms inside the dungeon, so rotating is part of the puzzle, not a menu. Style: chunky, colourful low-poly with each layer in a different colour of stone so you can track them, and a little adventurer seen from above.

## 55. Last Checkout
*Borrows: Supermarket Simulator and other job sims · Twist: the last week of shifts before the meteor hits*

A cashier job sim at a small-town supermarket, and the meteor hits in seven days. Each shift, customers unload their trolleys onto your belt. You scan each item (find the barcode), weigh the produce, bag things so nothing gets crushed (a small physics packing puzzle: eggs on top, cans at the bottom), take the cash and count out change. It's a satisfying, tactile job, and it's also the end of the world, so the shopping changes through the week: panic buyers, a man buying fifty candles, a kid who wants one last ice cream, a couple getting married on Thursday, people buying ingredients for a final dinner, and a manager who still cares about the coupon policy.

Seven shifts of about five minutes, a few customers who come back so you can follow their stories, and choices about what you let slide (do you charge them? take the IOU?). The store gets emptier and stranger, and the sky outside gets brighter. Style: fluorescent-lit, slightly grimy realism in three.js from your seat at the till, with the beep of the scanner as the game's heartbeat. Tap or click and drag to handle items.

## 56. Conductor
*Borrows: Rhythm Heaven · Twist: you conduct an orchestra with your finger, and it follows you, mistakes and all*

A rhythm game where you conduct a small, chaotic orchestra. Draw the beat pattern with your finger or mouse (down-up for two, a triangle for three, a cross for four), and the orchestra plays at the tempo and volume you conduct: big gestures make them loud, small ones soft. Cue each section when it comes in by pointing at it (the brass, the strings, the lone triangle player). The players' personalities make it hard: the drummer rushes, the violins drag, the tuba falls asleep in the slow movements, and the soloist goes rogue.

Five or six short pieces (a march, a waltz, a lullaby, a tango, a big finale), synthesized with WebAudio so they follow you in real time. Score is based on steadiness and cues, and the audience applauds, coughs or walks out. Style: a theatre seen from the podium, the orchestra as charming, flat caricatures, with stage lights that brighten as the music goes well.

## 57. Poltergeist
*Borrows: Untitled Goose Game, Ghost Master · Twist: you have to scare the new family out, but they get used to every trick*

A mischief stealth game where you're the ghost of an old house and a new family has just moved in. You can possess objects (rattle the cups, swing a door, switch on the radio, tip a book off a shelf, breathe on a window), but only when nobody's looking right at the object, or the scare is ruined. Each family member has a fear meter, and each gets used to scares: the same trick twice does less, so you have to escalate and combine (the lights flicker while the music box plays while the rocking chair rocks). Fill everyone's meter and they move out.

Several families across a few houses, each with members who react differently (the sceptical teenager, the parent with a torch, the dog who can see you, the toddler who thinks it's all hilarious), and a to-do list of specific scares to discover, in the spirit of Untitled Goose Game. Funny, never gory. Style: a top-down cutaway of the house in a soft storybook style, candlelight, a mischievous harpsichord score and lots of little sound effects.

## 58. Unlocked
*Borrows: Achievement Unlocked (flash) · Twist: every achievement changes the world, and later ones need earlier ones*

A single-screen game with 100 achievements, like the old flash game Achievement Unlocked. You're a small creature on one screen of platforms, and every achievement (jump ten times, touch every wall, stand still for 30 seconds, die in a silly way, find the secret) pops a satisfying banner and permanently changes the screen: a new platform appears, you get a hat that lets you bounce, gravity flips, the screen shrinks, a new character turns up who wants something. Some achievements only become possible because of earlier ones, and some are about undoing them.

The achievement list is always visible, with ??? for the ones not yet found and a cryptic hint for each. About 30–45 minutes to 100%. Make the banners funny, the unlock sound irresistible and the final achievement a delight. Style: simple, punchy flat vector with lots of juicy little effects, with the list in a side panel on desktop and a pull-up drawer on phones.

## 59. Reef
*Borrows: Islanders, Dorfromantik · Twist: you're rebuilding a coral reef, and the reward is who moves in*

A calm Islanders-style placement game where you rebuild a coral reef on a bare patch of sea floor. Each turn you're offered a few pieces to place (branching coral, brain coral, sea fans, sponges, anemones, rocks, seagrass), and each scores from its neighbours: anemones near the right coral, sea fans facing the current, seagrass on sand. Reach the score threshold to unlock the next pack. As the reef grows, species arrive when their habitat is right (a school of fish for big branching coral, a turtle for the seagrass, an octopus for rocky crevices), and those arrivals are the real reward.

Mid-game threats keep it from being purely zen: a warm-water bleaching event that drains the colour from corals that aren't shaded, a crown-of-thorns starfish, a storm. A reef log records every species you've attracted. Style: a beautiful, sunlit three.js underwater diorama with caustics, swaying coral and lively fish, viewed from a gentle orbit camera. Tap to place on phones.

## 60. Documentary
*Borrows: Pokémon Snap · Twist: a narrator writes the nature documentary from your footage*

A Pokémon Snap-style on-rails photography game where you're the camera operator on a nature documentary. A little boat drifts down a river through a strange, lush valley, and you film the creatures: aim, zoom and hold record to capture clips. Throw fruit, play a whistle or blow bubbles to coax out behaviours (feeding, courtship, a squabble, a lullaby). At the end of each trip your best clips are cut into a short documentary, and a calm, Attenborough-ish narrator (on-screen text, perhaps read aloud with the browser's speech) narrates it. The better your footage (rarer behaviours, better framing), the more wonderful the narration.

Five or six routes through different habitats (a misty forest, a reed marsh, a waterfall, a cave of glowing fungi, the river at night), about 30 species with a few behaviours each, and a field guide that fills in. Style: soft, painterly three.js in lush colours, creatures that feel alive and a little silly, and a gentle orchestral score.

## 61. Midnight Golf
*Borrows: mini golf, Untitled Goose Game · Twist: the course runs through a sleeping house, and noise wakes the family*

A mini golf game played through a house at midnight while the family sleeps. Each hole runs through a different room (down the hall carpet, across the kitchen tiles, through the cat flap, along the banister, past someone asleep on the sofa, around the dog's bowl) and ends in a mug, a slipper or a plughole. Every shot makes noise depending on how hard you hit and what the ball bounces off, and a noise meter fills in each room. Let it get too loud and someone wakes up, and the round is over. A soft putt on carpet is silent; a hard drive off the fridge is not.

Eighteen holes through one house, with par for strokes and a bonus for quiet holes, plus a dog and a cat who wander around and get in the way. The only light is moonlight and night-lights, so you can't always see where the ball went. Style: a cosy, dark-blue three.js house in soft, toy-like shapes with a three-quarter overhead camera. Drag back from the ball to aim and set power, the same on phone and desktop.

---

## House rules (paste after each idea)

> Build this as a new toy in this repo, following the README: its own folder, a toy.json with category "games", a `?demo` mode for the preview screenshot, and a preview from `npm run shots`. It has to play well on my phone with touch, as well as with a mouse and keyboard on desktop. I won't be around, so don't stop to ask me anything; make the call yourself and note it. Before you finish, play through it yourself in the browser preview (write an autoplay or a headless balance sim if tuning needs it), and fix what you find. Then commit and push to main so I can try it on theboxof.toys in the morning. End with a short note: how to play, what you cut, and what you'd tune next.
