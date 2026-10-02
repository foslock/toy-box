// Lost souls and strange things met on the way down. Each choice's go(run) changes the run and returns what happens:
// { text } to read, plus optionally pick (choose cards from your deck: 'remove' | 'bless' | 'transform' | 'copy',
// with n), cards (a card reward to choose from), fight ({ enemies, kind }), or charm (an id that was gained).
import { CARDS, makeCard, pool, def } from './cards.js';
import { CHARMS } from './charms.js';

const curseCount = run => run.deck.filter(c => CARDS[c.id].type === 'curse').length;
const holyPool = () => Object.values(CARDS).filter(c => ['common', 'uncommon', 'rare'].includes(c.rarity) && def(makeCard(c.id)).holy);

export const EVENTS = [
  {
    id: 'virgil', title: 'The Poet', acts: [0], art: 'laurel',
    text: 'A pale man in a laurel wreath waits where the path splits. "I was sent to guide you," he says, "as far as I am allowed to go."',
    choices: run => [
      { label: 'Walk with him', detail: run.charms.includes('lantern') ? 'Heal 12 HP.' : 'Gain Virgil\'s Lantern.', go(run) {
        if (run.charms.includes('lantern')) { run.heal(12); return { text: 'He walks beside you a while. The dark feels thinner.' }; }
        run.addCharm('lantern'); return { text: 'He hands you his lantern. "You will need it more than I will."', charm: 'lantern' };
      } },
      { label: 'Ask about the deep', detail: 'Bless a card.', go: () => ({ text: '"Every card you carry," he says, "the damned can carry too. Choose the ones only you can use."', pick: 'bless', n: 1 }) },
      { label: 'Go on alone', detail: 'Heal 5 HP.', go(run) { run.heal(5); return { text: 'You thank him and go on. When you look back, he is gone.' }; } },
    ],
  },
  {
    id: 'lethe', title: 'The Still Pool', acts: [0, 1, 2], art: 'pool',
    text: 'A pool of black water lies perfectly still in the rock. Those who drink from it, the souls whisper, forget.',
    choices: run => [
      { label: 'Drink', detail: 'Remove a card from your deck.', go: () => ({ text: 'The water is cold and tastes of nothing. Something you carried slips away.', pick: 'remove', n: 1 }) },
      { label: 'Drink deeply', detail: 'Lose 7 HP. Remove 2 cards.', disabled: run.hp <= 7, go(run) { run.hp -= 7; return { text: 'You drink until your head swims. Two things you carried are gone.', pick: 'remove', n: 2 }; } },
      { label: 'Leave it', detail: 'Nothing happens.', go: () => ({ text: 'You leave the pool undisturbed.' }) },
    ],
  },
  {
    id: 'dice', title: 'Dice of the Damned', acts: [0, 1, 2], art: 'dice',
    text: 'A grinning devil rattles bone dice in a skull. "Double or nothing, little light? Heaven doesn\'t mind a wager."',
    choices: run => [
      { label: 'Bet 50 obols', detail: 'Win 100 obols, or lose 50.', disabled: run.obols < 50, go(run) {
        const win = run.rng('events').chance(.5);
        run.obols += win ? 100 : -50;
        return { text: win ? 'Sixes. The devil scowls and pays up: 100 obols.' : 'Snake eyes. He pockets your 50 obols, cackling.' };
      } },
      { label: 'Bet your blood', detail: 'Lose 8 HP. Half the time, choose a rare card.', disabled: run.hp <= 8, go(run) {
        run.hp -= 8;
        const win = run.rng('events').chance(.5);
        if (!win) return { text: 'You lose. He licks the blood from the dice.' };
        return { text: 'You win. He spits and opens his coat: three stolen cards.', cards: run.cardChoices('boss', 3) };
      } },
      { label: 'Walk away', detail: 'Nothing happens.', go: () => ({ text: '"Coward," he calls after you, quite cheerfully.' }) },
    ],
  },
  {
    id: 'tomb', title: 'The Burning Tomb', acts: [1, 2], art: 'tomb',
    text: 'A stone tomb glows red from within. A voice under the lid begs you to let him out: "I only doubted. Is that so terrible?"',
    choices: run => [
      { label: 'Pry the lid open', detail: 'Lose 10 HP. Choose a Holy card.', disabled: run.hp <= 10, go(run) {
        run.hp -= 10;
        const r = run.rng('events');
        return { text: 'The fire inside bites your hands. The soul rises past you, weeping with relief, and leaves something behind.', cards: r.sample(holyPool(), 3).map(c => makeCard(c.id)) };
      } },
      { label: 'Loot the grave goods', detail: 'Gain 75 obols. Add Guilt to your deck.', go(run) { run.obols += 75; run.addCard(makeCard('guilt')); return { text: 'You take the coins from around the tomb. The voice goes quiet.' }; } },
      { label: 'Leave him', detail: 'Nothing happens.', go: () => ({ text: 'His pleading follows you a long way.' }) },
    ],
  },
  {
    id: 'mirror', title: 'The Black Mirror', acts: [0, 1, 2], art: 'mirror',
    text: 'A tall mirror of black glass shows you upside down, the way a demon would see you. Your reflection smiles first.',
    choices: run => [
      { label: 'Look deeper', detail: 'Transform a card into another.', go: () => ({ text: 'The reflection reaches into your deck and changes something.', pick: 'transform', n: 1 }) },
      { label: 'Step through', detail: 'Copy a card in your deck. Add Doubt.', go(run) { run.addCard(makeCard('doubt')); return { text: 'Cold glass, then you are through. You carry back two of something, and a doubt you can\'t shake.', pick: 'copy', n: 1 }; } },
      { label: 'Turn it to the wall', detail: 'Nothing happens.', go: () => ({ text: 'You turn the mirror around. Behind you, something sighs.' }) },
    ],
  },
  {
    id: 'soul', title: 'A Soul in Chains', acts: [0, 1, 2], art: 'chains',
    text: 'A soul sits under a heap of iron chains, too heavy to rise. "Carry a little of it for me?" she asks. "Only a little."',
    choices: run => [
      { label: 'Carry it', detail: 'Add Burden to your deck. Choose a rare card.', go(run) {
        run.addCard(makeCard('burden'));
        return { text: 'You take a chain onto your own shoulders. She rises, light as ash, and presses something into your hand.', cards: run.cardChoices('boss', 3) };
      } },
      { label: 'Pray over her', detail: curseCount(run) ? 'Remove a curse from your deck.' : 'Heal 12 HP.', go(run) {
        const curse = run.deck.find(c => CARDS[c.id].type === 'curse');
        if (curse) { run.removeCard(curse); return { text: `Your prayer loosens her chains, and yours. ${CARDS[curse.id].name} is gone from your deck.` }; }
        run.heal(12); return { text: 'Your prayer warms you both.' };
      } },
      { label: 'Leave her', detail: 'Nothing happens.', go: () => ({ text: '"Everyone does," she says.' }) },
    ],
  },
  {
    id: 'shrine', title: 'A Forgotten Shrine', acts: [0, 1, 2], art: 'shrine',
    text: 'In a niche in the rock, a tiny shrine to a saint nobody remembers. One candle still burns. There is a reliquary on the altar.',
    choices: run => [
      { label: 'Pray', detail: 'Bless a card.', go: () => ({ text: 'The candle flares as you kneel.', pick: 'bless', n: 1 }) },
      { label: 'Take the reliquary', detail: 'Gain a random charm. Add Guilt to your deck.', go(run) {
        const id = run.randomCharm(); run.addCharm(id); run.addCard(makeCard('guilt'));
        return { text: `Inside: ${id ? CHARMS[id].name : 'dust'}. The candle goes out.`, charm: id };
      } },
      { label: 'Light a candle', detail: 'Heal 8 HP.', go(run) { run.heal(8); return { text: 'You light a second candle from the first. Two small lights now.' }; } },
    ],
  },
  {
    id: 'ledger', title: 'Mammon\'s Ledger', acts: [1], art: 'ledger',
    text: 'A ledger lies open on a lectern of gold, every page a debt written in gold ink. On the last page, a space for your name.',
    choices: run => [
      { label: 'Sign it', detail: 'Gain 160 obols. Add Avarice to your deck.', go(run) { run.obols += 160; run.addCard(makeCard('avarice')); return { text: 'The ink is warm. Coins pour out of the spine of the book.' }; } },
      { label: 'Burn the ledger', detail: 'Lose 6 HP. Raise your Max HP by 5.', disabled: run.hp <= 6, go(run) { run.hp -= 6; run.maxHp += 5; run.hp += 5; return { text: 'The pages scream as they burn. A thousand debts, forgiven.' }; } },
      { label: 'Leave it', detail: 'Nothing happens.', go: () => ({ text: 'You leave the ledger open for someone else.' }) },
    ],
  },
  {
    id: 'fallen', title: 'The Fallen One', acts: [1, 2], art: 'brokenHalo',
    text: 'An angel with blackened wings sits alone on a ledge. "I fell a long time ago," it says. "I still remember how to fight. Shall I show you?"',
    choices: run => [
      { label: 'Fight it', detail: 'An elite fight. Win a charm.', go: () => ({ text: 'It stands, and its broken halo flares.', fight: { enemies: ['seraphFallen'], kind: 'elite' } }) },
      { label: 'Give it a charm', detail: run.charms.length > 1 ? 'Lose a random charm. Choose a rare card, raise Max HP by 6.' : 'You have no charm to give.', disabled: run.charms.length <= 1, go(run) {
        const options = run.charms.filter(c => c !== 'halo');
        const lost = run.rng('events').pick(options);
        run.charms.splice(run.charms.indexOf(lost), 1);
        run.maxHp += 6; run.hp += 6;
        return { text: `It turns ${CHARMS[lost].name} over in its hands for a long time. "Thank you." It gives you something in return.`, cards: run.cardChoices('boss', 3) };
      } },
      { label: 'Leave it be', detail: 'Nothing happens.', go: () => ({ text: '"Go on, then," it says. "Go down. I\'ll be here."' }) },
    ],
  },
  {
    id: 'wood', title: 'The Wood of Thorns', acts: [2], art: 'tree',
    text: 'Black trees with twisted, human shapes. When you brush a twig, it snaps and bleeds: "Why do you tear me? Have you no pity?"',
    choices: run => [
      { label: 'Take a thorned branch', detail: 'Lose 5 HP. Add a Burning Bush to your deck.', disabled: run.hp <= 5, go(run) { run.hp -= 5; run.addCard(makeCard('burningBush')); return { text: 'The tree howls. The branch burns in your hand without being consumed.' }; } },
      { label: 'Listen to them', detail: 'Heal 10 HP.', go(run) { run.heal(10); return { text: 'You sit with them a while. Being heard seems to ease them, and you.' }; } },
      { label: 'Hurry through', detail: 'Nothing happens.', go: () => ({ text: 'You keep your arms in tight and hurry on.' }) },
    ],
  },
  {
    id: 'ice', title: 'Frozen to the Neck', acts: [2], art: 'ice',
    text: 'A traitor frozen in the ice up to his chin offers secrets for his freedom. "I know where they keep the good things," he hisses.',
    choices: run => [
      { label: 'Free him', detail: 'Gain 110 obols. Add Doubt to your deck.', go(run) { run.obols += 110; run.addCard(makeCard('doubt')); return { text: 'He hands you a purse and runs. Only later do you wonder whose purse it was.' }; } },
      { label: 'Break the ice for yourself', detail: 'Transform 2 cards.', go: () => ({ text: 'You chip shapes out of the ice. Your cards come out of it changed.', pick: 'transform', n: 2 }) },
      { label: 'Leave him there', detail: 'Nothing happens.', go: () => ({ text: '"Traitor," he calls after you. That\'s rich.' }) },
    ],
  },
  {
    id: 'charon', title: 'The Ferryman\'s Toll', acts: [0], art: 'boat',
    text: 'At a black river, the ferryman holds out a bony hand. "Pay," he says, "or swim."',
    choices: run => [
      { label: 'Pay 35 obols', detail: 'Heal 20 HP.', disabled: run.obols < 35, go(run) { run.obols -= 35; run.heal(20); return { text: 'You sit in his boat and rest while he poles you across.' }; } },
      { label: 'Swim', detail: 'Lose 9 HP. Bless 2 random cards.', disabled: run.hp <= 9, go(run) {
        run.hp -= 9;
        const r = run.rng('events');
        for (const c of r.sample(run.deck.filter(c => CARDS[c.id].plus && !c.plus), 2)) run.bless(c);
        return { text: 'The water burns cold. You climb out on the far side, gasping, somehow stronger.' };
      } },
    ],
  },
  {
    id: 'choir', title: 'The Choir Below', acts: [0, 1, 2], art: 'choir',
    text: 'Singing drifts up from somewhere impossible, deep in the rock: a hymn you know, sung backwards.',
    choices: run => [
      { label: 'Sing along', detail: 'Choose a Power card.', go(run) {
        const r = run.rng('events');
        const powers = Object.values(CARDS).filter(c => c.type === 'power' && ['uncommon', 'rare'].includes(c.rarity));
        return { text: 'You sing it the right way round. The rock hums with you.', cards: r.sample(powers, 3).map(c => makeCard(c.id)) };
      } },
      { label: 'Cover your ears', detail: 'Heal 6 HP.', go(run) { run.heal(6); return { text: 'You hum something of your own until it fades.' }; } },
    ],
  },
  {
    id: 'harrow', title: 'The Cell of Souls', acts: [1, 2], art: 'gate',
    text: 'Behind a rusted gate, a crowd of souls stretches out their hands. The lock is old. The gate is hot to the touch.',
    choices: run => [
      { label: 'Break the gate', detail: 'Lose 12 HP. Gain a charm and Bless a card.', disabled: run.hp <= 12, go(run) {
        run.hp -= 12; const id = run.randomCharm('uncommon'); run.addCharm(id);
        return { text: `The gate gives way. The souls pour past you, and one leaves ${id ? CHARMS[id].name : 'a blessing'} in your hand.`, charm: id, pick: 'bless', n: 1 };
      } },
      { label: 'Leave them', detail: 'Nothing happens.', go: () => ({ text: 'You promise to come back. You don\'t know if you will.' }) },
    ],
  },
];

export function pickEvent(run) {
  const r = run.rng('events');
  let options = EVENTS.filter(e => e.acts.includes(run.act) && !run.seenEvents.includes(e.id));
  if (!options.length) options = EVENTS.filter(e => e.acts.includes(run.act));
  const e = r.pick(options);
  run.seenEvents.push(e.id);
  return e;
}
