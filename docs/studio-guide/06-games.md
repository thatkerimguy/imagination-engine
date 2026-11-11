# 6. Games inside the story

Every game block has a **win** and a **lose** branch (and sometimes more). Put blocks, or a jump
to another passage, in each branch. Most can also **save the score** in a number variable, for
later checks.

## Rhythm fights

A **Fight** block is a fight to the music: "Fight _enemy_ to _music_".

- **Enemy**: from Data → Enemies (or **New enemy…**).
- **Music**: a song, or **the music playing**. The song needs a beat grid (Sound → analyse or tap
  along). Without one, the fight plays a drum loop.
- **Difficulty**: Easy, Normal, Hard.
- **Style**:
  - **Take turns** — the enemy attacks, you answer;
  - **Free beat** — hit along with the music;
  - **Mixed**.
- **Length** in bars.
- **Chart** (optional): a scene with notes from Sequences. Its notes become the whole fight and
  its song plays. Leave it on **made from the enemy's moves** for an automatic fight.
- **Save the score in**, **If you win**, **If you lose**.

**How the reader plays:**

- **Tap** to strike or parry. On a computer that's `F`, `J`, `Space`, `Z` or `X`.
- **Swipe** to dodge. On a computer that's `D`, `K` or the arrow keys.

The enemy's attacks come from its **Moves**. Each move has a name, a **Rhythm** (one hit, two
quick hits, flurry, feint then hit, combo, long sweep), an **Answer** (tap to parry or swipe to
dodge) and a **Power**. For full control, give a move a **timeline**: **New timeline move…**
makes a Fight move sequence where you place every parry and dodge on the beat.

Tip: have readers do **Sound → Setup → Tap timing** on their phone. The fight then allows for how
late that device notices a tap.

## Turn-based battles

A **Battle** block: "Battle _enemy_", with **If you win**, **If you lose** and, when **The reader
may run** is ticked, **If you run away**.

Battles use:

- the hero's stats chosen in **Data → Hero** (HP, Max HP, Attack, Defense, MP);
- the enemy's strength, damage and defence;
- your **Skills** (Data → Skills);
- consumable **Items**.

The Problems panel warns if the hero stats aren't set.

## Items, quests and shops

- **Item** block: **Give**, **Take** or **Use** N × an item.
- **Quest** block: **Start**, **Move on** (to a step), **Complete** or **Fail** a quest.
- **Shop** block: "A shop that takes _gold_".
  - Add items **For sale**, each at its own price or the item's default price.
  - Tick **The reader can sell here, for half the price** to let readers sell.

Conditions can check **Carried item** and **Quest** status, so you can open doors with keys or
change scenes once a quest is done.

## Minigames

A **Minigame** block plays a small game. Pick the **Game**, set its options, and fill **If it
works** and **If it fails**. **Try it** plays the game right in the Studio with these settings;
nothing in the story changes.

| Game          | What the reader does                             | Main settings                                  |
| ------------- | ------------------------------------------------ | ---------------------------------------------- |
| Lockpick      | Stop a moving pick in the sweet spot, pin by pin | pins, pick speed, zone size, tries             |
| Memory        | Repeat a growing sequence of pads                | pads, rounds, pace, mistakes allowed           |
| Cipher        | Decode scrambled words                           | the words (per language), time limit           |
| Typing duel   | Type the phrases in time                         | the phrases (per language), seconds per prompt |
| Quick time    | Hit each prompt in its window                    | prompts, seconds per prompt                    |
| Dice          | Roll to reach a target total, with rerolls       | dice, sides, target total, rerolls             |
| Slider puzzle | Put the tiles back in order                      | board size, mixing moves, time limit           |
| Tension       | Keep a drifting marker inside a zone             | seconds to hold, time limit, zone drift        |

- **Title on screen** is optional; without one, the game shows its own name.
- Besides the score, each game can save one of its results, like pins opened, tries left, words
  solved or seconds taken, with **Save … in**.
- The Problems panel warns when settings make a game almost impossible to win or to lose.

## Your own minigame, from parts

Choose **Your own, from parts** as the game to build a new one from pieces:

- **Meters**: numbers the reader sees as bars, from 0 up to a maximum, each with a starting
  value.
- **Buttons**: what the reader can tap.
- **Dice to roll**: how many, how many sides.
- **Time limit**, and whether the reader fails or succeeds **when time runs out**.
- **Score from**: a meter, or **Success or failure only**.
- **Rules**: these run from top to bottom. Each one reads like a sentence:

  > **When** _the reader taps_ "Pump" **and** _pressure is at least 8_ **then** _the reader
  > fails_.

  The **When** part can be:
  - the game starts;
  - the reader taps (a button);
  - the dice are rolled;
  - a meter changes;
  - a second passes;
  - time runs out.

  The **then** part can add to, take from or set a meter, add the roll to a meter, or make the
  reader succeed or fail.

The game ends when a rule says so, or when the clock runs out. Use **Try it** often while you
build.
