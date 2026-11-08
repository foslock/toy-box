// Gullhaven Borough Lost Property — the ledger, 1961–2001.
// [date, item, where found, handed in by, collected by, clerk's note, clerk]
// Clerks: HB Harold Bewes (1961–76), JP Joan Pike (1964–92), DO Dennis Oyelaran (1974–81),
//         MT Maureen Tully (1984–98), PS Priya Sandhu (1994–2001).
// Spoilers below. The story: every 14 March from 1962, a woman giving a different bird's name
// hands in a present for "M." at the bench by the bandstand. Joan keeps them in Box M.
// She is Iris Penhale, who gave up her baby, Mary, at St Agnes House in 1961.
// Mary was adopted, became Maureen Tully, and came to work in this office in 1984.

export const CLERKS = {
  HB: 'H. Bewes', JP: 'J. Pike', DO: 'D. Oyelaran', MT: 'M. Tully', PS: 'P. Sandhu',
};

const RAW = [
// ---- 1961 ----
['1961-01-09', "Umbrella, black, gent's", 'Platform 2, Gullhaven station', 'Porter', 'Unclaimed', 'First entry in the new ledger. Begun as I mean to go on.', 'HB'],
['1961-01-23', 'Glove, left, sheepskin', 'Promenade, near the bandstand', 'Mr F. Doble', 'Unclaimed', 'One glove is of no use to anybody. Retained per Regulation 4: three months, then to auction.', 'HB'],
['1961-02-06', 'Spectacles, horn-rimmed', 'Lifeboat station steps', 'Coxswain R. Tremain', 'Mr A. Cuthbert', 'Mr Cuthbert also enquired after his dog. Not here.', 'HB'],
['1961-02-07', 'Dog, terrier, answers to Biscuit', 'Bus shelter, Harbour Row', 'Mrs P. Vosper', 'Mr A. Cuthbert', 'Livestock is not lost property. Accepted under protest. Fed it half my sandwich.', 'HB'],
['1961-02-19', 'Newspaper, folded, crossword completed in ink', 'Promenade, bench by the pier', 'Constable Treloar', 'Unclaimed, discarded', 'Logged for completeness. The crossword was correct.', 'HB'],
['1961-03-02', 'Umbrella, black', 'Pier Theatre, row F', 'Usher', 'Unclaimed', '', 'HB'],
['1961-04-20', 'Handbag, brown leather', 'Bus shelter outside St Agnes House', 'Driver, route 7', 'Miss I. Penhale', "Young lady, very quiet. Contents checked in her presence: purse, comb, and an infant's hospital bracelet marked MARY P. 14.3.61. She held the bracelet the entire time I filled in the form.", 'HB'],
['1961-05-11', 'Knitting, half a scarf, on needles', 'Bench outside the library', 'Librarian', 'Mrs J. Sowden', 'Mrs Sowden says she will finish it by Christmas. Which Christmas, she did not say.', 'HB'],
['1961-06-17', 'Bucket and spade', 'Main beach, by the groyne', 'Lifeguard', 'Unclaimed', 'The summer begins. God help us.', 'HB'],
['1961-07-29', 'Teeth, false, upper set', 'Pier, by the whelk stall', 'Mr D. Hocking', 'Mrs A. Vosper', 'Mrs Vosper says they fell out while she was laughing. At what, she did not say.', 'HB'],
['1961-08-12', 'Wallet, brown, contents three pounds', 'Golden Mile arcade', 'Arcade attendant', 'Mr G. Rook', '', 'HB'],
['1961-08-30', 'Sandwiches, fish paste, in paper', 'Station Road, bench by the bus stop', 'Porter', 'Unclaimed, discarded', 'I do not log sandwiches. I have logged these as a warning to others.', 'HB'],
['1961-09-04', "Umbrella, ladies', floral", 'Station buffet', 'Waitress', 'Unclaimed', 'Umbrellas this year: 41.', 'HB'],
['1961-11-30', 'Hat, trilby, grey', 'Promenade shelter', 'Constable Treloar', 'Mr G. Rook', 'Mr Rook again.', 'HB'],
// ---- 1962 ----
['1962-01-15', 'Overcoat, navy, gold buttons', 'Station waiting room', 'Porter', 'Unclaimed', 'Buttons kept separately in case of dispute.', 'HB'],
['1962-03-14', "Rattle, child's, silver, engraved M", 'Promenade, bench by the bandstand', 'Mrs Wren', 'Unclaimed (to auction 14 June)', 'Finder asked that it be kept "for M., should she ever come asking". I explained Regulation 4. She said she understood perfectly, and thanked me.', 'HB'],
['1962-05-21', "Bicycle, gent's, green", 'Station forecourt', 'Porter', 'Mr L. Polglase', '', 'HB'],
['1962-07-08', 'Ventriloquist\'s dummy, answers to Lord Pemberton', 'Pier Theatre stage door', 'Stage doorman', 'The Great Alfredo', 'Mr Alfredo claims the dummy walked off on its own. I have no comment.', 'HB'],
['1962-08-19', "Sandal, child's, left", 'Main beach', 'Lifeguard', 'Unclaimed', '', 'HB'],
['1962-10-03', 'Umbrella, black', 'Bus, route 7, top deck', 'Driver', 'Unclaimed', '', 'HB'],
['1962-12-24', 'Parcel, wrapped, labelled NOT UNTIL CHRISTMAS', 'Platform 1', 'Porter', 'Mrs J. Sowden', 'Collected at five to five on Christmas Eve. A close shave.', 'HB'],
// ---- 1963 ----
['1963-01-20', 'Glove, right, sheepskin', 'Promenade, near the bandstand', 'Mr F. Doble', 'Unclaimed', 'The other one. Two years late, and the first went to auction. Sic transit gloria.', 'HB'],
['1963-03-14', "Bonnet and mittens, knitted, yellow, child's", 'Promenade, bench by the bandstand', 'Mrs Finch', 'Unclaimed (to auction)', 'Same bench. Same day of the year, to the day. Name tape inside reads M. I would swear it is the same woman as last March, but she gave a different name. Not my affair.', 'HB'],
['1963-04-11', 'Dog, terrier, Biscuit', 'Fish market', 'Fishmonger', 'Mr A. Cuthbert', 'Biscuit again. Smelling strongly of hake.', 'HB'],
['1963-06-29', 'Kite, red, with tail', 'The headland', 'Mr T. Jago', 'Unclaimed', '', 'HB'],
['1963-09-09', 'Umbrella, black, broken', 'Station', 'Porter', 'Unclaimed', 'Umbrella number 100 since this ledger began. I have started to keep count, and I wish I had not.', 'HB'],
['1963-11-02', 'Ring, wedding, gold', 'Inside a mackerel, fish market', 'Fishmonger', 'Mrs E. Trethewey', 'Lost overboard off the Shag Rocks in 1959. Mrs Trethewey fainted at the counter.', 'HB'],
// ---- 1964 ----
['1964-02-17', 'Scarf, college, striped', 'Station', 'Porter', 'Unclaimed', '', 'HB'],
['1964-03-14', "Shoes, child's, red, first walking shoes", 'Promenade, bench by the bandstand', 'Mrs Robin', 'Unclaimed (to auction)', 'The third March running. Same bench, same note in the box: for M. The lady will not leave an address.', 'HB'],
['1964-04-06', 'One junior clerk, Miss J. Pike', 'Borough offices', 'The Borough', '-', 'Miss Pike joins the office today. She has neat handwriting and laughs at things. We shall see.', 'HB'],
['1964-05-30', 'Handbag, red patent', 'Pier Theatre, stalls', 'Usher', 'Mrs K. Penrose', 'Lady said thank you three times. Lovely.', 'JP'],
['1964-06-14', "Auction lot 7: shoes, child's, red (see 14 March)", 'Borough auction rooms', '-', 'J. Pike, two shillings and sixpence', "I couldn't stand it. They're under my desk.", 'JP'],
['1964-07-14', 'Buckets and spades, two of each', 'Main beach', 'Lifeguard', 'Unclaimed', 'Do they breed?', 'JP'],
['1964-08-22', 'Hat, panama', 'Promenade', 'Constable Treloar', 'Mr G. Rook', 'Mr Bewes says Mr Rook loses a hat every summer.', 'JP'],
['1964-10-12', 'Umbrella, black', 'Bus shelter, Harbour Row', 'Mrs P. Vosper', 'Unclaimed', '', 'JP'],
['1964-12-01', 'Teeth, false, upper set', 'Bus, route 7', 'Driver', 'Mrs A. Vosper', 'Mrs Vosper says it is the same set as 1961. I said I should hope so.', 'JP'],
// ---- 1965 ----
['1965-01-08', 'Glasses, reading, in case', 'Library steps', 'Librarian', 'Mr A. Cuthbert', '', 'JP'],
['1965-03-14', 'Noah\'s ark, wooden, with animals in pairs', 'Promenade, bench by the bandstand', 'Mrs Lark', 'Kept, Box M', 'Mr Bewes says auction in three months. I have put it on the top shelf in the back office with the little red shoes, in a box I have marked M. He never looks up there.', 'JP'],
['1965-05-05', 'Budgerigar, blue, in cage', 'Bus, route 3', 'Driver', 'Unclaimed, rehoused with J. Pike', 'It says "Who\'s a pretty boy". I am taking it home. His name is Captain.', 'JP'],
['1965-07-20', 'Lilo, inflatable, punctured', 'Main beach', 'Lifeguard', 'Unclaimed', '', 'HB'],
['1965-08-14', 'Accordion', 'End of the pier', 'Mr D. Hocking', 'Mr S. Angove', 'Mr Angove played us a tune by way of thanks. Miss Pike danced. I did not.', 'HB'],
['1965-11-23', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', '160.', 'HB'],
// ---- 1966 ----
['1966-02-02', 'Dog, terrier, Biscuit', 'Church of St Petroc, vestry', 'Rev. Polkinghorne', 'Mr A. Cuthbert', 'Biscuit attended evensong.', 'JP'],
['1966-03-14', "Tricycle, child's, blue", 'Promenade, bench by the bandstand', 'Mrs Thrush', 'Kept, Box M', 'She pushed it all the way up Station Road herself. Mrs Thrush, this time. Last year she was Mrs Lark. I am going to start a list.', 'JP'],
['1966-06-11', 'Bowler hat', 'Station', 'Porter', 'Mr G. Rook', '', 'JP'],
['1966-07-31', 'Rosette, red, white and blue', 'Railway Arms', 'Landlord', 'Unclaimed', 'Found the morning after the Final. Mr Bewes declines to comment on the Final.', 'JP'],
['1966-09-17', 'Wig, ginger, small', 'Pier Theatre', 'Usher', 'The Great Alfredo', 'It belongs to Lord Pemberton.', 'JP'],
['1966-12-12', "Umbrella, ladies', blue", 'Bus, route 7', 'Driver', 'Unclaimed', '', 'JP'],
// ---- 1967 ----
['1967-01-28', 'Glove, left, leather', 'Promenade', 'Mr F. Doble', 'Mr F. Doble', 'Mr Doble found his own glove. A first.', 'HB'],
['1967-03-14', "Wellington boots, red, child's size 10", 'Promenade, bench by the bandstand', 'Mrs Starling', 'Kept, Box M', 'Wren, Finch, Robin, Lark, Thrush, and now Starling. Every one a bird! I call her the bird lady. Mr Bewes says I read too many novels.', 'JP'],
['1967-05-19', 'Kite, red, with tail', 'The headland', 'Mr T. Jago', 'Mr T. Jago', 'Mr Jago has been minding it for four years. He has decided to give it back.', 'HB'],
['1967-08-03', "Swimming costume, gent's", 'Main beach', 'Lifeguard', 'Unclaimed', 'One shudders to think.', 'HB'],
['1967-10-30', 'Umbrella, black', 'Pier Theatre', 'Usher', 'Unclaimed', '200.', 'HB'],
// ---- 1968 ----
['1968-03-14', 'Picture book, The Lighthouse Cat, inscribed "for M. on her seventh"', 'Promenade, bench by the bandstand', 'Mrs Linnet', 'Kept, Box M', 'Very well. Box M. It may stay on the top shelf. I am not responsible for it and I have not seen it.', 'HB'],
['1968-04-22', 'Briefcase, locked', 'Station, first class', 'Porter', 'Mr R. Carne, solicitor', '', 'HB'],
['1968-07-07', 'Teeth, false, lower set', 'Bus, route 7', 'Driver', 'Mrs A. Vosper', 'She has a matching pair now.', 'JP'],
['1968-08-25', 'Sun hat, straw, with cherries', 'Pier', 'Mr D. Hocking', 'Unclaimed', '', 'JP'],
['1968-11-06', 'Guy, for a bonfire', 'Station forecourt', 'Porter', 'Unclaimed, burned', 'A day late. Burned in the yard at Mr Bewes\'s insistence. Regulations do not cover guys.', 'HB'],
// ---- 1969 ----
['1969-01-14', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', '', 'HB'],
['1969-03-14', 'Skipping rope, wooden handles', 'Promenade, bench by the bandstand', 'Mrs Nuthatch', 'Kept, Box M', 'She was early, so I was early. We had a cup of tea and talked about the weather and not about anything else.', 'JP'],
['1969-07-21', 'Telescope, brass', 'The headland', 'Mr T. Jago', 'Unclaimed', 'Somebody was looking at the Moon last night. Weren\'t we all.', 'JP'],
['1969-09-02', 'Dog, terrier, Biscuit', 'Golden Mile arcade', 'Attendant', 'Mr A. Cuthbert', 'Biscuit is going grey. So is Mr Cuthbert.', 'JP'],
// ---- 1970 ----
['1970-03-14', "Roller skates, child's", 'Promenade, bench by the bandstand', 'Mrs Swift', 'Kept, Box M', 'I asked Mrs Swift who M is. She said, "Somebody who\'ll come asking, one day." Then she asked if this office would still be here in twenty years. Mr Bewes said undoubtedly.', 'JP'],
['1970-06-06', 'Camera, Instamatic', 'Pier', 'Mr D. Hocking', 'Unclaimed', 'Mr Bewes had the film developed. Twenty-four pictures of seagulls.', 'JP'],
['1970-08-18', 'Umbrella, black', 'Bus, route 3', 'Driver', 'Unclaimed', '300.', 'HB'],
['1970-10-10', 'Glove, right, sheepskin', 'Promenade, near the bandstand', 'Mr F. Doble', 'Unclaimed', 'I despair of Mr Doble.', 'HB'],
// ---- 1971 ----
['1971-02-15', 'Purse, contents six and eightpence', 'Station buffet', 'Waitress', 'Mrs J. Sowden', 'Decimal Day. Contents six and eightpence, or thirty-three new pence, or nothing at all, depending on whom you ask.', 'HB'],
['1971-03-14', 'Satchel, school, leather, initial M', 'Promenade, bench by the bandstand', 'Mrs Wagtail', 'Kept, Box M', 'Box M is two boxes now.', 'JP'],
['1971-07-04', 'Lord Pemberton', 'Bus, route 7, top deck, front seat', 'Driver', 'The Great Alfredo', 'Enjoying the view, apparently.', 'HB'],
['1971-09-29', 'Pram, navy, empty', 'Promenade', 'Constable Treloar', 'Mrs K. Penrose', 'Empty, thank heavens. Baby was with Granny all along.', 'JP'],
// ---- 1972 ----
['1972-03-14', 'Stamp album, with stamps of forty countries', 'Promenade, bench by the bandstand', 'Mrs Martin', 'Kept, Box M', 'Martin is a bird. I have looked it up. The house martin. Very well, Miss Pike.', 'HB'],
['1972-05-08', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', '', 'HB'],
['1972-08-01', 'Dog, terrier, young', 'Harbour Row', 'Mrs P. Vosper', 'Mr A. Cuthbert', 'This is not Biscuit. This is Biscuit the Second. Biscuit passed in June. Mr Cuthbert says this one is already hopeless.', 'JP'],
['1972-12-20', 'Cash box, Christmas club', 'Railway Arms', 'Landlord', 'Landlord', 'Contents counted twice in front of witnesses.', 'HB'],
// ---- 1973 ----
['1973-02-11', 'Cardigan, brown', 'Library', 'Librarian', 'Unclaimed', '', 'JP'],
['1973-03-14', "Bicycle, girl's, blue, with basket", 'Promenade, bench by the bandstand', 'Mrs Siskin', 'Kept, Box M', 'Siskin. Mr Bewes had to look this one up too. She had wheeled it all the way. I gave her tea. Her hands shake now.', 'JP'],
['1973-06-30', 'Spade, metal, bent', 'Main beach', 'Lifeguard', 'Unclaimed', '', 'HB'],
['1973-10-17', 'Hat, deerstalker', 'Station', 'Porter', 'Mr G. Rook', 'Mr Rook\'s twelfth hat. I know what you\'re thinking. Mr Rook is NOT a bird lady. He is just careless.', 'JP'],
// ---- 1974 ----
['1974-03-14', 'Transistor radio, red', 'Promenade, bench by the bandstand', 'Mrs Curlew', 'Kept, Box M', 'The book said seventh in 1968, so she would be thirteen this year. A radio for a girl of thirteen. Somebody has thought about it.', 'JP'],
['1974-04-01', 'One junior clerk, D. Oyelaran, aged 17', 'Job Centre', 'The Borough', '-', 'That is Mr Bewes\'s joke, not mine. Far out.', 'DO'],
['1974-07-27', 'Lord Pemberton, singed', 'Pier Theatre, after the fire', 'Fire brigade', 'The Great Alfredo', 'The theatre is gone. The dummy came through it. Mr Alfredo cried. I did a bit too.', 'DO'],
['1974-07-27', 'Forty-one assorted items from the pier fire', 'Pier Theatre, cloakroom', 'Fire brigade', 'Various', 'Everything the brigade pulled out. Joan and me sorted till eleven at night. Mr Bewes made cocoa.', 'DO'],
['1974-09-12', 'LP record, rock', 'Bus, route 7', 'Driver', 'Unclaimed', 'Too good to auction. I\'m minding it.', 'DO'],
['1974-11-30', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', '500. Half way to glory.', 'HB'],
// ---- 1975 ----
['1975-03-14', 'Diary, with lock and key, blank', 'Promenade, bench by the bandstand', 'Mrs Merlin', 'Kept, Box M', 'Joan says this goes up top in Box M with the rest. Who is M?? Joan just tapped her nose.', 'DO'],
['1975-05-02', 'Football boots', 'Recreation ground', 'Groundsman', 'D. Oyelaran', 'Mine. Sorry.', 'DO'],
['1975-08-09', 'Glove, right, sheepskin', 'Promenade, near the bandstand', 'Mr F. Doble', 'Unclaimed', 'Mr Doble again. Put it in the drawer. I am too old to auction gloves.', 'HB'],
['1975-12-08', 'Umbrella, black', 'Bus, route 7', 'Driver', 'Unclaimed', '', 'HB'],
// ---- 1976 ----
['1976-03-14', 'LP record, pop, still sealed', 'Promenade, bench by the bandstand', 'Mrs Teal', 'Kept, Box M', 'Fifteen this year, Joan says. I said who is? Joan said, M. Joan is very annoying.', 'DO'],
['1976-07-03', 'Ice cream, cornet, melted', 'Promenade', 'Constable Treloar', 'Unclaimed, discarded', 'Heatwave. The constable brought it in as a joke. Mr Bewes logged it anyway. Regulations are regulations.', 'DO'],
['1976-08-31', 'Rubber stamp, RETAINED PER REG. 4', 'Senior clerk\'s desk', 'H. Bewes', 'J. Pike', 'Mr Bewes retires today. He handed in his own stamp and told me to look after it and the office, in that order. One thousand umbrellas exactly, he says. He has kept count all along.', 'JP'],
['1976-09-01', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', 'Somebody has to count them now. One.', 'JP'],
// ---- 1977 ----
['1977-03-14', 'Powder compact, silver', 'Promenade, bench by the bandstand', 'Mrs Dunnock', 'Kept, Box M', 'Mr Bewes came in on his morning walk just to ask if she had been. I said yes. He said "Good," and went home.', 'JP'],
['1977-06-08', 'Flag, Union, on a stick', 'Station', 'Porter', 'Unclaimed', 'Jubilee. There are about four hundred of these. This is the only one I am writing down.', 'DO'],
['1977-09-15', 'Dog, terrier, Biscuit the Second', 'Fish market', 'Fishmonger', 'Mr A. Cuthbert', 'In the hake again. It runs in the family.', 'DO'],
// ---- 1978 ----
['1978-02-27', 'Guitar, acoustic, in case', 'Bus, route 7', 'Driver', 'D. Oyelaran', 'Mine. Again. Sorry, Joan.', 'DO'],
['1978-03-14', 'Paintbox and brushes', 'Promenade, bench by the bandstand', 'Mrs Goldfinch', 'Kept, Box M', '', 'JP'],
['1978-08-12', 'Wallet, black', 'Golden Mile arcade', 'Attendant', 'Mr G. Rook', 'Mr Rook. Not a hat, for once. Joan says he is branching out.', 'DO'],
// ---- 1979 ----
['1979-01-30', 'Birdcage, empty', 'Back office', 'J. Pike', '-', 'Captain the budgie died on Sunday, aged fourteen. Den says I should get another. I have hung the cage in the back office. It is the right place for it.', 'JP'],
['1979-03-14', 'Locket, silver, empty', 'Promenade, bench by the bandstand', 'Mrs Kittiwake', 'Kept, Box M', 'Eighteen this year. I asked if she would like to put a photograph in it. She said she has not got one.', 'JP'],
['1979-03-15', 'List of names, handwritten', 'My handbag', 'J. Pike', '-', 'Written in here so I do not lose it. Wren 62, Finch 63, Robin 64, Lark 65, Thrush 66, Starling 67, Linnet 68, Nuthatch 69, Swift 70, Wagtail 71, Martin 72, Siskin 73, Curlew 74, Merlin 75, Teal 76, Dunnock 77, Goldfinch 78, Kittiwake 79. Never the same name twice. Always the 14th of March. Always the bench by the bandstand.', 'JP'],
['1979-07-14', 'Sunglasses, mirrored', 'Main beach', 'Lifeguard', 'D. Oyelaran', 'Not mine. Well, mine now.', 'DO'],
// ---- 1980 ----
['1980-01-02', 'Snow globe, Gullhaven pier', 'Platform 2', 'Porter', 'Unclaimed', 'The pier in the snow globe still has its theatre.', 'DO'],
['1980-03-14', "Umbrella, ladies', new, never opened", 'Promenade, bench by the bandstand', 'Mrs Fulmar', 'Kept, Box M', 'An umbrella! Mr Bewes laughed until he had to sit down. Box M.', 'JP'],
['1980-06-21', 'Hat, sou\'wester', 'Lifeboat station steps', 'Coxswain R. Tremain', 'Mr G. Rook', '', 'DO'],
// ---- 1981 ----
['1981-03-14', 'Suitcase, small, new', 'Promenade, bench by the bandstand', 'Mrs Plover', 'Kept, Box M', 'Twenty, Joan says. A suitcase, for going away with. I\'m going away myself on Monday, London, to be in a band. Cheers all. It has been far out.', 'DO'],
['1981-03-20', 'Mug, KEEP ON TRUCKIN\'', 'Staff room', 'D. Oyelaran', 'Nobody. He left it for us.', 'Dennis has gone. The office is very quiet. I keep making three cups of tea.', 'JP'],
['1981-07-29', 'Tin, commemorative, royal wedding', 'Bus, route 3', 'Driver', 'Unclaimed', '', 'JP'],
['1981-11-11', 'Umbrella, black', 'Church of St Petroc', 'Rev. Polkinghorne', 'Unclaimed', '', 'JP'],
// ---- 1982 ----
['1982-03-14', 'Road atlas of Britain', 'Promenade, bench by the bandstand', 'Mrs Shearwater', 'Kept, Box M', 'She walks with a stick now. She sat on the bench a long time after. I took her a cup of tea and she asked if anybody had ever come asking. No.', 'JP'],
['1982-10-04', 'Glove, left, sheepskin', 'Coat pocket, house clearance', 'Mr Doble\'s daughter', 'Miss S. Doble', 'Mr Doble has died. His daughter brought in a left glove from his coat. We have had a right sheepskin glove in the drawer since 1975 that nobody claimed. They match. I gave her both.', 'JP'],
// ---- 1983 ----
['1983-02-14', 'Walking stick, ash, H. Bewes', 'His cottage', 'Miss E. Bewes', 'Kept, umbrella stand', 'Mr Bewes died on Sunday. His sister says he wanted the office to have his stick "to stop the umbrellas falling over". It is in the stand.', 'JP'],
['1983-03-14', 'Tea set for two, china', 'Promenade, bench by the bandstand', 'Mrs Kestrel', 'Kept, Box M', 'For a first home, I suppose. I told her Mr Bewes had died. She said she was sorry, and that he had been kind to her once, a long time ago.', 'JP'],
['1983-08-19', 'Lord Pemberton, without Alfredo', 'End of the pier', 'Mr D. Hocking', 'Unclaimed', 'The Great Alfredo has retired to Torquay. Lord Pemberton appears to have stayed. He is in the back office. He stares.', 'JP'],
// ---- 1984 ----
['1984-01-09', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', '', 'JP'],
['1984-02-20', 'One clerk, M. Tully', 'Borough typing pool', 'The Borough', '-', 'STARTED TODAY. THE SHELVES ARE A DISGRACE. THERE IS A DUMMY IN THE BACK OFFICE AND IT IS LOOKING AT ME.', 'MT'],
['1984-03-14', 'Clock, carriage, brass', 'Promenade, bench by the bandstand', 'Mrs Redshank', 'Kept, Box M', 'OLD LADY WITH A STICK HANDED THIS IN AND WOULD NOT LEAVE A REAL ADDRESS. JOAN SAYS PUT IT IN BOX M AND NOT TO ASK. I ASKED. JOAN WOULD NOT SAY.', 'MT'],
['1984-06-30', 'Cassette player, personal', 'Bus, route 7', 'Driver', 'Unclaimed', 'NOT OUR PROBLEM.', 'MT'],
['1984-09-03', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', 'JOAN SAYS WE COUNT THE UMBRELLAS. I SAID WHY. SHE SAID FOR MR BEWES. I SAID WHO.', 'MT'],
// ---- 1985 ----
['1985-03-14', 'Teapot, blue', 'Promenade, bench by the bandstand', 'Mrs Goldcrest', 'Kept, Box M', 'BOX M NOW TAKES UP A WHOLE SHELF. JOAN SAYS LEAVE IT. I SAID IT IS AGAINST REGULATION 4. JOAN SAID SO WAS MR BEWES.', 'MT'],
['1985-09-16', 'Dog lead, red, worn', 'House clearance, Harbour Row', 'Neighbours', 'Kept, on the hook', 'Mr Cuthbert has died. Biscuit the Second has gone to Mrs Vosper. We have kept the lead on the hook by the door.', 'JP'],
['1985-11-22', 'Hat, flat cap', 'Railway Arms', 'Landlord', 'Mr G. Rook', 'HAT NUMBER TWENTY-SIX ACCORDING TO JOAN. SHE KEEPS COUNT OF THAT AS WELL.', 'MT'],
// ---- 1986 ----
['1986-03-14', 'Cake tin, empty', 'Staff room', 'J. Pike', 'M. Tully', 'Maureen\'s birthday. Twenty-five today. After one sherry she told me she was adopted out of St Agnes House as a baby. "Collected," she said, "like lost property," and if I laughed she would report me to the Borough. I did not laugh.', 'JP'],
['1986-03-14', 'Scarf, cashmere, grey', 'Promenade, bench by the bandstand', 'Mrs Bunting', 'Kept, Box M', 'ANOTHER ONE FOR BOX M. ON MY BIRTHDAY, AS IT HAPPENS. JOAN WENT VERY QUIET AND HAD TO GO AND SIT IN THE BACK.', 'MT'],
['1986-03-17', 'Ledger, 1961, from the cellar', 'Borough archive', 'J. Pike', 'J. Pike', 'I went back through Mr Bewes\'s first ledger. April 1961: St Agnes House, a Miss I. Penhale, and a baby\'s bracelet. I am not going to say anything. It is not my business. It is all I can think about.', 'JP'],
['1986-07-12', 'Beach ball, enormous', 'Main beach', 'Lifeguard', 'Unclaimed', 'DOES NOT FIT ON ANY SHELF. DEFLATED PER REGULATION 4.', 'MT'],
// ---- 1987 ----
['1987-03-14', "Gloves, leather, ladies', good ones", 'Promenade, bench by the bandstand', 'Mrs Heron', 'Kept, Box M', 'SHE ASKED MY NAME. I TOLD HER. SHE SAT ON THE BENCH OUTSIDE FOR AN HOUR IN THE RAIN. JOAN TOOK HER AN UMBRELLA FROM THE STAND.', 'MT'],
['1987-10-16', 'Beach hut door, painted blue, number 23', 'Main beach', 'Lifeguard', 'Unclaimed', 'THE STORM LAST NIGHT. EVERYTHING IS EVERYWHERE.', 'MT'],
['1987-10-16', 'Deckchair, striped, and three others', 'Station Road', 'Constable Treloar', 'Unclaimed', 'The storm. The constable brought these up himself on a handcart. Maureen made him a tea and he stayed two hours.', 'JP'],
['1987-10-19', 'Umbrella, black, inside out', 'Promenade', 'Constable Treloar', 'Unclaimed', 'THE CONSTABLE AGAIN. NOT OUR PROBLEM. TWO SUGARS.', 'MT'],
// ---- 1988 ----
['1988-03-14', 'Chocolates, box, unopened', 'Handed over the counter', 'Mrs Wheatear', 'M. Tully', 'SHE GAVE THEM TO ME. NOT TO THE COUNTER, TO ME. SHE SAID "HAPPY BIRTHDAY, MAUREEN." I HAVE NEVER TOLD HER IT IS MY BIRTHDAY. I HAVE NOT EATEN THEM. THEY ARE IN BOX M.', 'MT'],
['1988-05-27', 'Teeth, false, both sets, in a jar', 'Bus, route 7', 'Driver', 'Mrs A. Vosper', 'Mrs Vosper is ninety-one. She said "Third time lucky," and winked at me.', 'JP'],
['1988-08-09', 'Mobile telephone, brick-sized', 'Station, first class', 'Porter', 'Mr R. Carne', 'WEIGHS MORE THAN THE CASH BOX.', 'MT'],
// ---- 1989 ----
['1989-03-14', 'Fountain pen, green', 'Promenade, bench by the bandstand', 'Mrs Sparrow', 'Kept, Box M', 'I PUT IT IN BOX M. JOAN TOOK IT OUT AND PUT IT IN MY DRAWER. I PUT IT BACK IN BOX M. THIS IS NOT FUNNY.', 'MT'],
['1989-07-02', 'Sandcastle flag, paper', 'Main beach', 'Lifeguard', 'Unclaimed', 'Logged in memory of Mr Bewes, who would have logged it.', 'JP'],
// ---- 1990 ----
['1990-03-14', 'Nothing', '-', '-', '-', 'She did not come. Maureen waited on the bench until six. Then she came back in and said "Not our problem" and locked up very carefully.', 'JP'],
['1990-06-15', 'Hat, bucket, Italia 90', 'Railway Arms', 'Landlord', 'Mr G. Rook', 'MR ROOK IS SEVENTY-FOUR. JOAN SAYS HE IS GETTING WORSE. I SAY HE IS GETTING BETTER AT IT.', 'MT'],
['1990-09-24', 'Lord Pemberton', 'Back office', 'J. Pike', 'Unclaimed', 'Sent a photograph of him to Mr Alfredo in Torquay. He wrote back: "Keep him. He likes you."', 'JP'],
// ---- 1991 ----
['1991-03-14', 'Postcards of Gullhaven, thirty, blank', 'Promenade, bench by the bandstand', 'Mrs Nightingale', 'Kept, Box M', 'Thirty. Thirty postcards, one for each year. She held Maureen\'s hand over the counter and Maureen let her.', 'JP'],
['1991-08-20', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', 'I HAVE STARTED COUNTING THEM AGAIN. DO NOT TELL JOAN.', 'MT'],
// ---- 1992 ----
['1992-03-31', 'Key, back office', 'Senior clerk\'s desk', 'J. Pike', 'M. Tully', 'I retire today, after twenty-eight years. My last instruction to the office: Box M is not to be cleared. Not ever. Not even by you, Maureen.', 'JP'],
['1992-04-01', 'Birdcage, empty', 'Back office', 'J. Pike', 'Kept', 'JOAN HAS GONE. SHE LEFT THE BUDGIE CAGE AND A NOTE THAT SAYS "YOU\'LL WORK IT OUT." I HAVE NO IDEA WHAT SHE MEANS.', 'MT'],
['1992-11-03', 'Glove, left, sheepskin', 'Promenade, near the bandstand', 'Mr P. Doble', 'Unclaimed', 'MR DOBLE\'S GRANDSON. IT IS HEREDITARY.', 'MT'],
// ---- 1993 ----
['1993-03-14', 'Cardigan, knitted, yellow, adult size', 'Promenade, bench by the bandstand', 'Mrs Wren', 'Kept, Box M', 'WREN. JOAN\'S LIST SAYS WREN WAS THE FIRST ONE. IT IS THE SAME YELLOW AS THE LITTLE BONNET IN 1963. SHE SAID "THERE. THAT\'S ALL OF THEM," AND WENT.', 'MT'],
['1993-06-05', 'Spade, child\'s, blue', 'Main beach', 'Lifeguard', 'Unclaimed', '', 'MT'],
// ---- 1994 ----
['1994-03-14', 'Nothing', '-', '-', '-', 'SHE DID NOT COME. I WAITED ON THE BENCH UNTIL SIX. NOT OUR PROBLEM.', 'MT'],
['1994-09-05', 'One clerk, P. Sandhu', 'The university, apparently', 'The Borough', '-', 'NEW GIRL. WANTS TO PUT THE LEDGER ON A COMPUTER. OVER MY DEAD BODY.', 'MT'],
['1994-10-11', 'Umbrella, black', 'Bus, route 7', 'Driver', 'Unclaimed', 'Maureen counts the umbrellas, so I asked what number this was. She said "Mind your own business," and then, quietly, "1,402."', 'PS'],
// ---- 1995 ----
['1995-02-08', 'Hearing aid', 'Seaview Nursing Home', 'Matron', 'M. Tully, to return', 'MATRON SAYS ONE OF HER LADIES KEEPS ASKING FOR "THE GIRL AT THE LOST PROPERTY". I TOOK IT BACK MYSELF. ROOM 4.', 'MT'],
['1995-03-14', 'Nothing', '-', '-', '-', 'Maureen took the afternoon off, which she never does. Back at five with sand on her shoes.', 'PS'],
['1995-07-22', 'Lord Pemberton', 'Back office', 'P. Sandhu', 'Unclaimed', 'Moved him to face the wall. Found him facing the room again next morning. Maureen says she has no idea.', 'PS'],
// ---- 1996 ----
['1996-03-14', 'Biscuits, home-made, in a tin', 'Seaview Nursing Home, room 4', 'M. Tully', 'M. Tully', 'I TAKE THEM TO HER NOW. WE DO NOT TALK ABOUT IT. WE TALK ABOUT THE WEATHER.', 'MT'],
['1996-05-20', 'Paper ledgers, 1961 to 1996', 'The office', 'P. Sandhu', 'Kept, cellar', '[System note] The ledger is on the computer now. I typed in every entry from 1961 myself, all of Mr Bewes\'s umbrellas included. Maureen has forgiven me. Mostly.', 'PS'],
['1996-08-14', 'Pager, black', 'Golden Mile arcade', 'Attendant', 'Unclaimed', 'Somebody keeps paging it. 07734. Maureen worked out it says hello upside down.', 'PS'],
// ---- 1997 ----
['1997-02-11', 'Carrier bag, effects of the late Mrs Iris Penhale', 'Seaview Nursing Home, room 4', 'Matron', 'M. Tully', 'NO NEXT OF KIN, MATRON SAYS. INSIDE: A BABY\'S HOSPITAL BRACELET, MARY P. 14.3.61. A LIST OF BIRDS. A PHOTOGRAPH OF THIS OFFICE. I SIGNED FOR IT AS NEXT OF KIN. MATRON DID NOT ASK.', 'MT'],
['1997-02-12', 'Nothing', '-', '-', '-', 'Maureen is off. The Borough says compassionate leave. I didn\'t know she had anyone.', 'PS'],
['1997-06-30', 'Virtual pet, egg-shaped', 'Bus, route 3', 'Driver', 'Unclaimed', 'It keeps beeping. I have been feeding it. It has died twice.', 'PS'],
['1997-09-01', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', '', 'PS'],
// ---- 1998 ----
['1998-03-14', 'Box M, twenty-eight items, see ledger 1964 to 1993', 'Top shelf, back office', 'J. Pike (1965)', 'M. Tully', 'MINE.', 'MT'],
['1998-03-30', 'Nothing', '-', '-', '-', 'Maureen has left. Moved away. The top shelf is empty and she has taped a note to it: KEEP IT EMPTY. SOMEBODY ALWAYS NEEDS ONE.', 'PS'],
['1998-07-07', 'Hat, baseball cap', 'Golden Mile arcade', 'Attendant', 'Mr G. Rook', 'Mr Rook is eighty-two. He shook my hand and said I was the fifth clerk to give him back a hat.', 'PS'],
// ---- 1999 ----
['1999-03-14', 'Postcard of Gullhaven, written', 'Posted to the office', 'Royal Mail', 'P. Sandhu', 'One postcard, from abroad. It says: "Still not your problem. Love, M." I\'ve pinned it above the terminal.', 'PS'],
['1999-08-11', 'Eclipse glasses, cardboard', 'The headland', 'Mr T. Jago', 'Unclaimed', 'Mr Jago is eighty-one and still on the headland every day with a telescope. He says the eclipse was "adequate".', 'PS'],
['1999-12-31', 'Survival kit, Y2K, tins and candles', 'Station', 'Porter', 'Unclaimed', 'In case the computer stops at midnight. If you are reading this, it didn\'t.', 'PS'],
// ---- 2000 ----
['2000-01-01', 'Party hat, gold, 2000', 'Promenade', 'Constable Treloar', 'Unclaimed', 'Constable Treloar\'s last week before he retires. He brought this in "for old times\' sake" and asked after Maureen.', 'PS'],
['2000-03-14', 'Postcard of Gullhaven, written', 'Posted to the office', 'Royal Mail', 'P. Sandhu', '"Is the shelf still empty? It had better be. M." It is.', 'PS'],
['2000-06-18', 'Dog, terrier, answers to Biscuit', 'Fish market', 'Fishmonger', 'Mrs Vosper (granddaughter)', 'A Biscuit, in the hake. I don\'t know which number this one is. The fishmonger says it is the same dog it always is.', 'PS'],
['2000-10-02', 'Umbrella, black', 'Station', 'Porter', 'Unclaimed', '1,600. Somebody has to.', 'PS'],
// ---- 2001 ----
['2001-03-14', 'Postcard of Gullhaven, written', 'Posted to the office', 'Royal Mail', 'P. Sandhu', '"Forty. Not a word. M." I bought a cake anyway and ate it on the bench by the bandstand.', 'PS'],
['2001-05-09', 'Glove, right, sheepskin', 'Promenade, near the bandstand', 'Mr P. Doble', 'Mr P. Doble', 'He found his own glove. I wrote it down because I was told it was a first.', 'PS'],
['2001-11-30', 'Terminal, ledger, one', 'This desk', 'P. Sandhu', 'The new clerk', 'I\'m off too. Whoever you are: the old entries are better than the new ones. Read them. And the shelf stays empty.', 'PS'],
];

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const ENTRIES = RAW.map(([d, item, where, by, coll, note, c], i) => {
  const [y, m, day] = d.split('-').map(Number);
  return { id: i, no: 1000 + i * 7 + (y - 1961) * 3, date: d, y, dateText: `${String(day).padStart(2, '0')} ${MON[m - 1]} ${y}`, item, where, by, coll, note, c };
});

// The entry shown only at the end.
export const FINAL = {
  dateText: '08 NOV 2002', item: 'Key, brass, on a tag marked BOX M', where: 'Posted to the office', by: 'M. Tully', coll: 'The new clerk',
  note: 'FOR THE NEW CLERK, WHO I AM TOLD HAS BEEN READING. SHE WAS IRIS. I WAS MARY, FOR SIX WEEKS, AND THEN I WAS MAUREEN. JOAN KNEW BEFORE I DID. THE KEY IS FOR THE BACK OFFICE. THE SHELF IS FOR WHOEVER NEEDS IT NEXT. NOT YOUR PROBLEM. THANK YOU ANYWAY.', c: 'MT',
};

// Iris's presents, for the ending roll.
export const BOX = RAW.filter(r => r[0].slice(5) === '03-14' && /^Mrs [A-Z][a-z]+$/.test(r[3]))
  .map(r => ({ y: +r[0].slice(0, 4), item: r[1], as: r[3] }));

// ---- search ----
const STOP = new Set([]);
export const tokens = s => (s.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || []);
const norm = w => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
for (const e of ENTRIES) {
  const text = [e.item, e.where, e.by, e.coll, e.note, e.c].join(' ');
  e.words = new Set(tokens(text).map(norm));
}
export function search(q) {
  const ws = tokens(q).map(norm).filter(w => !STOP.has(w));
  if (!ws.length) return { ws, hits: [] };
  const hits = ENTRIES.filter(e => ws.every(w => e.words.has(w)));
  return { ws, hits };
}
