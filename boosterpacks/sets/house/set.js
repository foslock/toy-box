// Series 1: Around the House. 100 household things, valued like trading cards: commons are worth up to $1 and
// uncommons up to $10, both mostly toward the cheap end; a rare can be worth anything, from $2 to a $1,500 piano.
import { ROOMS } from './rooms.js';

// [id, name, room, rarity, card value in dollars, [move, power, move text], flavor text, size line]
const LIST = [
  // ---- commons ----
  ['spoon', 'Wooden Spoon', 'kitchen', 'C', 0.17, ['Stir the Pot', 10, 'Flip a coin. Heads: the soup is perfect. Tails: it’s still pretty good.'], 'Rest it across the pot and it won’t boil over. Probably.', 'L 12 in · 1.4 oz'],
  ['whisk', 'Whisk', 'kitchen', 'C', 0.36, ['Whip It', 20, 'Turn 2 egg whites into 1 cloud.'], 'Eleven wires, one job, no chill.', 'L 11 in · 3 oz'],
  ['mug', 'Coffee Mug', 'kitchen', 'C', 0.52, ['Morning Boost', 20, 'Heal 30 damage from your Active item. Only works before 9 a.m.'], 'Says WORLD’S BEST on it. Nobody remembers who gave it to whom.', 'HT 4 in · 12 fl oz'],
  ['saltshaker', 'Salt Shaker', 'kitchen', 'C', 0.08, ['Pinch', 10, 'Add a little. Then a little more.'], 'Its partner, Pepper, hasn’t been seen since the picnic.', 'HT 3 in · 2 oz'],
  ['sponge', 'Kitchen Sponge', 'kitchen', 'C', 0.04, ['Scrub', 10, 'Remove 1 stain. The green side does the hard part.'], 'Replace it every two weeks. Nobody does.', 'L 4.3 in · 0.5 oz'],
  ['timer', 'Kitchen Timer', 'kitchen', 'C', 0.33, ['Ding!', 20, 'At the end of the turn, everyone jumps.'], 'Shaped like a tomato. Used for eggs.', 'HT 2.5 in · 3 oz'],
  ['ovenmitt', 'Oven Mitt', 'kitchen', 'C', 0.44, ['Heat Shield', 20, 'Prevent all damage from Hot attacks during your opponent’s next turn.'], 'Has one small hole, exactly where your thumb goes.', 'L 13 in · 4 oz'],
  ['duck', 'Rubber Duck', 'bathroom', 'C', 0.10, ['Squeak', 10, 'Your opponent flinches and can’t attack next turn.'], 'Programmers explain their bugs to it. It never interrupts.', 'HT 3.5 in · 1.8 oz'],
  ['toothbrush', 'Toothbrush', 'bathroom', 'C', 0.09, ['Brush Twice', 10, 'This attack does 10 damage two times. Don’t forget to floss.'], 'Replace it every three months. It has been eleven.', 'L 7.5 in · 0.7 oz'],
  ['soap', 'Bar of Soap', 'bathroom', 'C', 0.06, ['Slip Away', 10, 'Retreat for free. Then drop it in the shower.'], 'Gets a little smaller every day until it’s just a legend.', 'L 3.5 in · 4 oz'],
  ['toiletpaper', 'Toilet Paper', 'bathroom', 'C', 0.03, ['Over, Not Under', 10, 'End the argument. Your side wins.'], 'Worth its weight in gold for about three weeks in 2020.', 'Ø 4.5 in · 200 sheets'],
  ['plunger', 'Plunger', 'bathroom', 'C', 0.55, ['Suction', 20, 'Pull 1 card back from your opponent’s discard pile. Don’t ask.'], 'You don’t want to need it. You really want to have it.', 'HT 19 in · 14 oz'],
  ['shampoo', 'Shampoo', 'bathroom', 'C', 0.24, ['Lather, Rinse, Repeat', 10, 'Use this attack again. And again. The bottle says so.'], 'Smells like a waterfall, according to the bottle.', 'HT 8 in · 13.5 fl oz'],
  ['remote', 'TV Remote', 'living', 'C', 0.87, ['Channel Surf', 20, 'Look at the top 5 cards of your deck. Put them back. Nothing’s on.'], 'Lives in the couch cushions. Visits the fridge.', 'L 8 in · 4 oz'],
  ['candle', 'Jar Candle', 'living', 'C', 0.70, ['Ambiance', 20, 'Your opponent’s item is Relaxed and can’t attack next turn.'], 'Scent: Clean Linen. Smells like no linen anyone has ever washed.', 'HT 4 in · 50 hr burn'],
  ['lightbulb', 'Light Bulb', 'living', 'C', 0.15, ['Bright Idea', 20, 'Draw 2 cards. How many does it take to change one? Just you.'], 'Burns out the night you need to find the other shoe.', 'HT 4.5 in · 60 W'],
  ['sock', 'Lost Sock', 'bedroom', 'C', 0.06, ['Vanish', 10, 'Shuffle this card into your opponent’s deck. It’s theirs now.'], 'Its partner went into the dryer and on to another dimension.', 'L 10 in · 0.7 oz'],
  ['hanger', 'Clothes Hanger', 'bedroom', 'C', 0.03, ['Hang In There', 10, 'This item can’t be knocked out this turn.'], 'They multiply in the closet when the door is shut.', 'W 17 in · 1.6 oz'],
  ['scrunchie', 'Scrunchie', 'bedroom', 'C', 0.03, ['Tie Up', 10, 'Your opponent’s item can’t retreat.'], 'There are eleven in the house and none on your wrist.', 'Ø 3.5 in · 0.3 oz'],
  ['screwdriver', 'Screwdriver', 'garage', 'C', 0.28, ['Righty-Tighty', 20, 'Tighten 1 loose item. Picked the wrong way? Lefty-loosey.'], 'It’s the wrong size. It’s always the wrong size.', 'L 8 in · 3 oz'],
  ['ducttape', 'Duct Tape', 'garage', 'C', 0.42, ['Quick Fix', 20, 'Heal 20 damage from any item. Silver is a color, right?'], 'If it moves and shouldn’t, tape it.', 'Ø 4.5 in · 60 yd'],
  ['battery', 'AA Battery', 'garage', 'C', 0.05, ['Recharge', 10, 'Attach this card to a TV Remote. It works again!'], 'The junk drawer has twenty. All dead. None labeled.', 'L 2 in · 1.5 V'],
  ['tapemeasure', 'Tape Measure', 'garage', 'C', 0.76, ['Measure Twice', 20, 'Look at the top card of your opponent’s deck. Twice.'], 'The snap-back is the most dangerous thing in the garage.', '25 ft · 11 oz'],
  ['flashlight', 'Flashlight', 'garage', 'C', 0.98, ['Search the Dark', 20, 'Search your deck for any 1 card. Found the remote!'], 'The batteries are always in the other flashlight.', 'L 7 in · 300 lm'],
  ['pencil', 'Pencil', 'office', 'C', 0.02, ['Sketch', 10, 'Draw 1 card. Get it? Draw.'], 'Number 2, but first in our hearts.', 'L 7.5 in · HB'],
  ['paperclip', 'Paper Clip', 'office', 'C', 0.02, ['Hold It Together', 10, 'Attach up to 20 cards to this item. The 21st bends it forever.'], 'Has been a lock pick, a phone tool and a fidget toy. Rarely a paper clip.', 'L 1.3 in · 0.02 oz'],
  ['stickynotes', 'Sticky Notes', 'office', 'C', 0.18, ['Reminder', 10, 'Next turn, remember to attack. It’s written right here.'], 'Covered in phone numbers that belong to no one.', '3 × 3 in · 100 sheets'],
  ['scissors', 'Scissors', 'office', 'C', 0.50, ['Snip', 20, 'Cut the tag off 1 item. Beats paper. Loses to rock.'], 'Nobody knows where they are, and everybody just used them.', 'L 8 in · 3.5 oz'],
  ['stapler', 'Stapler', 'office', 'C', 1.00, ['Staple', 20, 'Attach 1 card to another card. Permanently.'], 'Red, and not to be borrowed. Ever.', 'L 7 in · 12 oz'],
  ['pushpin', 'Push Pin', 'office', 'C', 0.02, ['Pin Down', 10, 'Your opponent’s item stays exactly where it is.'], 'Found by bare feet with remarkable accuracy.', 'L 0.8 in · 0.03 oz'],
  ['flowerpot', 'Flower Pot', 'garden', 'C', 0.27, ['Take Root', 10, 'This item can’t be moved by your opponent’s attacks.'], 'The succulent inside thrives on complete neglect.', 'Ø 5 in · 1.8 lb'],
  ['trowel', 'Garden Trowel', 'garden', 'C', 0.63, ['Dig', 20, 'Search your discard pile for 1 card. Also an earring from 1998.'], 'Worms consider it a natural disaster.', 'L 12 in · 7 oz'],
  ['nozzle', 'Hose Nozzle', 'garden', 'C', 0.76, ['Jet Setting', 20, 'Pick a spray: Jet, Mist, Shower, Cone, Flat or Soak Your Sibling.'], 'Nine settings, and it always goes back to Jet.', 'L 7 in · 8 oz'],
  ['clothespin', 'Clothespin', 'laundry', 'C', 0.02, ['Pinch', 10, 'Hang 1 wet sock out to dry.'], 'Spring-loaded and deeply loyal.', 'L 3 in · 0.2 oz'],
  ['lintroller', 'Lint Roller', 'laundry', 'C', 0.20, ['Roll Away', 10, 'Remove all fur from your items. There’s more.'], 'Everyone with a cat owns one. Everyone with a cat is still covered in fur.', 'L 8 in · 60 sheets'],
  ['pod', 'Laundry Pod', 'laundry', 'C', 0.02, ['Swirl', 10, 'Clean 1 load. Do not eat. We mean it.'], 'Looks like candy. Is not candy. Keep away from kids.', 'Ø 1.5 in · 0.9 oz'],
  ['thread', 'Spool of Thread', 'laundry', 'C', 0.12, ['Mend', 10, 'Heal 10 damage from 1 Fabric item. Needle sold separately.'], 'The needle is in the pincushion, or in your thumb.', 'HT 2 in · 250 yd'],
  // ---- uncommons ----
  ['toaster', 'Toaster', 'kitchen', 'U', 2.85, ['Pop Up', 40, 'Launch 2 slices of toast. Catch both for 20 more damage.'], 'It has two settings: still bread and charcoal.', 'HT 7.5 in · 3 lb'],
  ['kettle', 'Tea Kettle', 'kitchen', 'U', 1.15, ['Whistle', 40, 'Your opponent’s item is Distracted until the tea is poured.'], 'A watched kettle does boil. It just takes forever.', 'HT 8.5 in · 2 qt'],
  ['skillet', 'Cast Iron Skillet', 'kitchen', 'U', 4.67, ['Sear', 60, 'Never wash it with soap. Someone will remind you.'], 'Handed down four generations, and heavier each time.', 'Ø 12 in · 7.5 lb'],
  ['blender', 'Blender', 'kitchen', 'U', 9.05, ['Puree', 70, 'Shuffle your opponent’s hand. Loudly.'], 'Five speeds, all of them “wake up the house.”', 'HT 17 in · 6.5 lb'],
  ['chefknife', 'Chef’s Knife', 'kitchen', 'U', 7.35, ['Julienne', 60, 'Discard 1 carrot. Do 10 damage for every matchstick.'], 'Keep it sharp. Dull knives are the dangerous ones.', 'L 13 in · 8 oz'],
  ['rollingpin', 'Rolling Pin', 'kitchen', 'U', 0.27, ['Flatten', 30, 'Your opponent’s next item is a quarter inch thick.'], 'Also crushes crackers and settles arguments about pie crust.', 'L 18 in · 1.8 lb'],
  ['waffleiron', 'Waffle Iron', 'kitchen', 'U', 6.52, ['Grid Lock', 50, 'Your opponent’s item can’t retreat. It’s covered in batter.'], 'Every square is a tiny syrup pool.', 'W 11 in · 5 lb'],
  ['hairdryer', 'Hair Dryer', 'bathroom', 'U', 4.12, ['Blowout', 50, 'Blow your opponent’s item to the bench. Hair everywhere.'], 'Also defrosts freezers and warms cold sheets.', 'L 9.5 in · 1875 W'],
  ['towels', 'Bath Towels', 'bathroom', 'U', 0.40, ['Dry Off', 30, 'Remove all Wet conditions from your items.'], 'Always know where yours is.', '27 × 54 in · set of 2'],
  ['scale', 'Bathroom Scale', 'bathroom', 'U', 0.85, ['Weigh In', 40, 'Your opponent reveals their weight. Everyone is uncomfortable.'], 'Five pounds heavier after the holidays, and always right about it.', '12 × 12 in · 3.3 lb'],
  ['tablelamp', 'Table Lamp', 'living', 'U', 6.66, ['Mood Lighting', 40, 'All of your items do 10 more damage after sunset.'], 'The shade is on straight for the first time in years.', 'HT 22 in · 6 lb'],
  ['monstera', 'Monstera', 'living', 'U', 4.82, ['Unfurl', 50, 'Grow 1 new leaf. Nobody sees it happen.'], 'It was a foot tall when you bought it. Now it has opinions about the curtains.', 'HT 32 in · 13 lb'],
  ['pillow', 'Throw Pillow', 'living', 'U', 0.60, ['Fluff', 30, 'Prevent 30 damage. Can’t be used for actual sleeping.'], 'Decorative. Do not lean. Do not nap. Just admire.', '18 × 18 in · 1 lb'],
  ['frame', 'Picture Frame', 'living', 'U', 0.31, ['Say Cheese', 30, 'Your opponent must smile until their next turn.'], 'Still holds the stock photo of a family nobody knows.', '8 × 10 in · 14 oz'],
  ['wallclock', 'Wall Clock', 'living', 'U', 1.57, ['Tick Tock', 40, 'Take another turn. It’s two minutes slow anyway.'], 'Silent all day. Deafening at 3 a.m.', 'Ø 12 in · 2 lb'],
  ['alarmclock', 'Alarm Clock', 'bedroom', 'U', 0.34, ['Wake Up!', 40, 'Your opponent’s Asleep item wakes up grumpy. Snooze: do this again in 9 minutes.'], 'Its snooze button is the most-pressed button in the house.', 'HT 6 in · 12 oz'],
  ['teddy', 'Teddy Bear', 'bedroom', 'U', 0.73, ['Big Hug', 40, 'Heal 40 damage. Also fixes bad dreams.'], 'One eye is a button, sewn back on after a run-in with the dog.', 'HT 14 in · 11 oz'],
  ['slippers', 'Bunny Slippers', 'bedroom', 'U', 0.51, ['Hop', 30, 'Retreat to the kitchen without making a sound.'], 'The left bunny has seen things.', 'L 11 in · 14 oz a pair'],
  ['piggybank', 'Piggy Bank', 'bedroom', 'U', 0.25, ['Save Up', 30, 'Put a coin in. You’ll want it for the next pack.'], 'Holds about eleven dollars and a button.', 'HT 5 in · 12 oz'],
  ['lavalamp', 'Lava Lamp', 'bedroom', 'U', 1.32, ['Groovy', 40, 'Your opponent’s item is Hypnotized and watches the blobs instead.'], 'Takes two hours to warm up. Worth it.', 'HT 16 in · 3.3 lb'],
  ['hammer', 'Hammer', 'garage', 'U', 0.28, ['Nail It', 50, 'Flip a coin. If tails, this item does 20 damage to your thumb.'], 'To a hammer, everything looks like a nail.', 'L 13 in · 1.3 lb'],
  ['toolbox', 'Toolbox', 'garage', 'U', 5.70, ['Handy', 40, 'Search your deck for up to 3 tools. You’ll use one of them.'], 'Sixty compartments and one drawer of mystery screws.', 'W 19 in · 13 lb'],
  ['drill', 'Cordless Drill', 'garage', 'U', 10.00, ['Drill Down', 70, 'Does 20 more damage to walls. Check for pipes first.'], 'The battery is charged exactly when you don’t need it.', 'L 8 in · 20 V'],
  ['paintcan', 'Paint Can', 'garage', 'U', 1.92, ['Fresh Coat', 40, 'Change this item’s room to any room. Needs a second coat.'], 'The color is called Whispering Oatmeal.', '1 gal · 11 lb'],
  ['desklamp', 'Desk Lamp', 'office', 'U', 3.04, ['Spotlight', 40, 'Look at your opponent’s hand. It’s very well lit.'], 'Bends every way except the one you need.', 'HT 18 in · LED'],
  ['headphones', 'Headphones', 'office', 'U', 8.33, ['Tune Out', 50, 'Ignore every effect of your opponent’s next attack.'], 'Wireless now, so they tangle with other things instead.', '30 hr · 9 oz'],
  ['globe', 'Desk Globe', 'office', 'U', 3.62, ['Spin', 40, 'Spin it and point. That’s where you’re going on vacation.'], 'A few of the countries on it don’t exist anymore.', 'Ø 12 in · 2.6 lb'],
  ['wateringcan', 'Watering Can', 'garden', 'U', 0.47, ['Sprinkle', 30, 'Heal 10 damage from each of your Garden items.'], 'The tomatoes get the most. They complain the most.', '2 gal · 2 lb'],
  ['gnome', 'Garden Gnome', 'garden', 'U', 1.04, ['Stand Guard', 40, 'Your opponent can’t look at your garden. He’s watching.'], 'He moved. You didn’t see it, but he moved.', 'HT 12 in · 4 lb'],
  ['hosereel', 'Hose Reel', 'garden', 'U', 2.05, ['Soak', 50, 'Every item in play gets wet. Especially the one you aimed at.'], 'Winds up perfectly the first time. Never again.', '100 ft · 15 lb'],
  ['flamingo', 'Pink Flamingo', 'garden', 'U', 0.26, ['Strike a Pose', 30, 'Stand on one leg. Your opponent’s next attack misses.'], 'Came as a joke. Stayed for the compliments.', 'HT 32 in · 14 oz'],
  ['basket', 'Laundry Basket', 'laundry', 'U', 0.30, ['Pile Up', 30, 'Put 3 clean shirts in. They’re wrinkled now.'], 'Also a boat, a fort and a cat bed.', 'W 24 in · 2.6 lb'],
  ['iron', 'Iron', 'laundry', 'U', 2.32, ['Press', 40, 'Remove all Wrinkled conditions. Steam comes out of nowhere.'], 'You left it on. You didn’t. But you’ll go back and check.', 'L 11 in · 1700 W'],
  ['detergent', 'Detergent', 'laundry', 'U', 0.26, ['Stain Fighter', 30, 'Remove 1 grass stain. The ketchup stays.'], 'Mountain Fresh. Mountains don’t smell like that.', '100 fl oz · 64 loads'],
  // ---- rares ----
  ['standmixer', 'Stand Mixer', 'kitchen', 'R', 8.40, ['Knead', 120, 'Attach 1 accessory. There are forty. You own one.'], 'A wedding present that has outlasted two kitchens.', 'HT 14 in · 24 lb'],
  ['espresso', 'Espresso Machine', 'kitchen', 'R', 10.45, ['Double Shot', 140, 'This attack happens twice. Your hands shake a little.'], 'Nine bars of pressure, twenty minutes of cleaning.', 'HT 16 in · 20 lb'],
  ['airfryer', 'Air Fryer', 'kitchen', 'R', 2.00, ['Crisp', 100, 'It’s just a small convection oven. Don’t tell it.'], 'Its owners will tell you about it without being asked.', 'HT 13 in · 11 lb'],
  ['microwave', 'Microwave', 'kitchen', 'R', 2.67, ['Reheat', 100, 'Heal 60 damage. The middle stays frozen.'], 'Beep. Beep. Beep. Beep. Beep. (You opened it at 0:01.)', 'W 19 in · 26 lb'],
  ['fridge', 'Refrigerator', 'kitchen', 'R', 40.00, ['Deep Chill', 180, 'Your opponent’s item is Frozen. Also, who ate the leftovers?'], 'Its door is a gallery of drawings, magnets and takeout menus.', 'HT 70 in · 240 lb'],
  ['clawfoot', 'Clawfoot Tub', 'bathroom', 'R', 70.00, ['Soak', 150, 'Heal all damage from this item. It takes the next two turns off.'], 'Cast iron, four lion feet and room for one very relaxed person.', 'L 67 in · 310 lb'],
  ['smarttoilet', 'Smart Toilet', 'bathroom', 'R', 14.23, ['Warm Welcome', 130, 'The seat is already warm. Music plays. Nobody mentions it.'], 'Has more settings than the car.', 'HT 20 in · 100 lb'],
  ['sofa', 'Sofa', 'living', 'R', 16.10, ['Sink In', 120, 'Your opponent’s item can’t leave for the rest of the evening.'], 'Contains $4.36 in change and one earring, somewhere.', 'L 84 in · 130 lb'],
  ['tv', 'Flat-Screen TV', 'living', 'R', 9.71, ['Binge', 130, 'Skip your next three turns. Just one more episode.'], 'Sixty-five inches of “Are you still watching?”', '65 in · 48 lb'],
  ['recordplayer', 'Record Player', 'living', 'R', 4.20, ['Drop the Needle', 110, 'Flip a coin. If heads, play side B.'], 'Makes everything sound warm, especially the crackle.', 'W 17 in · 33⅓ rpm'],
  ['grandfatherclock', 'Grandfather Clock', 'living', 'R', 120, ['Chime the Hour', 160, 'Every Asleep item in play wakes up.'], 'Ninety years old. Still loses a minute every Tuesday.', 'HT 80 in · 175 lb'],
  ['chandelier', 'Chandelier', 'living', 'R', 15.20, ['Dazzle', 150, 'Your opponent’s item is Blinded until dessert.'], 'Four hundred crystals and two dead bulbs nobody can reach.', 'Ø 28 in · 12 lights'],
  ['piano', 'Grand Piano', 'living', 'R', 1500, ['Grand Finale', 250, 'Discard your hand. Take a bow.'], 'Nobody in the house plays it. Everybody dusts it.', 'L 7 ft · 750 lb'],
  ['aquarium', 'Aquarium', 'living', 'R', 5.12, ['Bubble Screen', 110, 'Prevent all damage done to this item by Kitchen items.'], 'Six fish, one plastic diver and a snail nobody bought.', '25 gal · 55 lb'],
  ['painting', 'Thrift Store Painting', 'living', 'R', 250, ['Hidden Value', 160, 'Flip a coin. Heads: a lost masterpiece. Tails: still a nice boat.'], 'Bought for twelve dollars. Appraised on television. Screamed.', '24 × 30 in · oil on canvas'],
  ['mattress', 'Memory Foam Mattress', 'bedroom', 'R', 13.33, ['Deep Sleep', 130, 'Heal all damage. It remembers exactly where you were lying.'], 'Arrived rolled up in a box the size of a mini fridge.', 'Queen · 75 lb'],
  ['console', 'Game Console', 'bedroom', 'R', 8.93, ['One More Level', 120, 'Keep attacking until someone calls you for dinner.'], 'The controller is always at 3% battery.', 'W 12 in · 9 lb'],
  ['bicycle', 'Bicycle', 'garage', 'R', 9.50, ['Coast', 120, 'Move this item anywhere without spending a turn.'], 'You never forget how to ride one. You do forget to pump the tires.', 'L 69 in · 21 speeds'],
  ['toolchest', 'Tool Chest', 'garage', 'R', 12.00, ['Organize', 130, 'Put your deck in any order you like. It won’t stay that way.'], 'Eleven drawers. One of them is just for sockets.', 'HT 40 in · 150 lb'],
  ['guitar', 'Electric Guitar', 'garage', 'R', 11.33, ['Power Chord', 140, 'Every item in play takes 20 damage. The neighbors take 40.'], 'Bought for the garage band. Knows the first four notes of every song.', 'L 39 in · 6 strings'],
  ['laptop', 'Laptop', 'office', 'R', 13.72, ['Reply All', 130, 'Every item in play gets an email. It’s about the printer.'], 'Forty-seven open tabs, and one of them is playing music.', '14 in · 3 lb'],
  ['gamingpc', 'Gaming PC', 'office', 'R', 25.00, ['RGB Mode', 150, 'Glows in every color. The fans sound like a jet taking off.'], 'Also the warmest heater in the house.', 'HT 19 in · 31 lb'],
  ['typewriter', 'Typewriter', 'office', 'R', 5.76, ['Ding & Return', 110, 'At the end of every line, attack again.'], 'No spell check. No backspace. No fear.', 'W 13 in · 13 lb'],
  ['grill', 'Kettle Grill', 'garden', 'R', 3.43, ['Flare-Up', 110, 'Do 30 more damage. The burgers are a little black.'], 'Whoever holds the tongs is in charge.', 'Ø 22 in · 33 lb'],
  ['hottub', 'Hot Tub', 'garden', 'R', 500, ['Jets On', 170, 'Heal all damage from all your items. Nobody gets out till dark.'], 'Seats six. Five if Uncle Ray brings the cooler.', '7 × 7 ft · 400 gal'],
  ['lawnmower', 'Lawn Mower', 'garden', 'R', 6.47, ['Mow Down', 120, 'Saturday morning: discard every Garden card your opponent has in play.'], 'Starts on the first pull, as long as nobody is watching.', 'W 22 in · 66 lb'],
  ['washer', 'Washing Machine', 'laundry', 'R', 12.54, ['Spin Cycle', 140, 'Shuffle every item in play. It walks across the floor.'], 'Eats exactly one sock per load.', 'HT 38 in · 150 lb'],
  ['robovac', 'Robot Vacuum', 'laundry', 'R', 7.48, ['Auto Clean', 110, 'Attacks every turn on its own. Gets stuck under the couch.'], 'The cat rides it. The cat is in charge.', 'Ø 14 in · 8 lb'],
  ['sewingmachine', 'Sewing Machine', 'laundry', 'R', 4.57, ['Zigzag', 110, 'This attack hits twice, in a zigzag.'], 'Grandma’s. Still threads itself better than you do.', 'W 16 in · 15 lb'],
];

// The dearest rares turn up one pack in this many; every other rare shares the rest equally.
const ODDS = { gamingpc: 45, fridge: 70, clawfoot: 120, grandfatherclock: 200, painting: 400, hottub: 800, piano: 2000 };

const set = {
  id: 'house',
  name: 'Around the House',
  series: 'Series 1',
  code: 'HOM',
  price: 499,                          // a pack, in cents (see store.js for how boxes are priced)
  // How much more often cheap cards turn up than dear ones, per rarity: weight = (cheapest / value) ^ curve.
  // Rares are all equally likely (curve 0), except the dear ones in ODDS, which have fixed odds.
  curve: { C: .35, U: .55, R: 0 },
  types: ROOMS,
  typeLabel: 'Room',
  // Pack wrappers: each shows one of these rares big on the front, over its colors.
  wrappers: [
    { hero: 'piano', colors: ['#2b1a5e', '#7b3fe4', '#f3c6ff'], accent: '#ffd76a' },
    { hero: 'espresso', colors: ['#5e1414', '#e4452e', '#ffd2a8'], accent: '#ffe08a' },
    { hero: 'gamingpc', colors: ['#082d3a', '#11a4b8', '#b8fff6'], accent: '#ffe66d' },
  ],
  blurb: 'One hundred things from around the house, from a two-cent paper clip to a grand piano.',
  items: LIST.map(([id, name, type, rarity, dollars, [move, power, text], flavor, size], i) => ({
    id, name, type, rarity, price: Math.round(dollars * 100), move: { name: move, power, text }, flavor, size, no: i + 1, odds: ODDS[id],
  })),
  models: {},
};
// Models load file by file, so one broken file only costs its own items their pictures (they get a stand-in).
const MODEL_FILES = ['kitchen', 'bathroom', 'living', 'bedroom', 'garage', 'office', 'garden', 'laundry'];
set.ready = Promise.all(MODEL_FILES.map(f => import(`./models/${f}.js`)
  .then(m => Object.assign(set.models, m.default))
  .catch(e => console.error(`Models in ${f}.js didn't load:`, e))));
export default set;
