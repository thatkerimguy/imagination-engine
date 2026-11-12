# The Studio guide

How to make a novel in the Imagination Engine Studio, from the first passage to a published
book on the shelf. You never need to write code: everything here is a form, a block, a graph or
a timeline.

Read it in order the first time. Later, jump to the chapter you need.

| Chapter                                                              | What it covers                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [1. Getting started](01-getting-started.md)                          | Opening the Studio on a computer, on the phone and online; the screen; novels, kits, saving and sync   |
| [2. Writing](02-writing.md)                                          | The Write workspace: passages, blocks, text effects, choices, conditions, translation, the script view |
| [3. Flow, Logic and Data](03-flow-logic-data.md)                     | The story map, rules and routines, characters, variables, items, quests, the hero                      |
| [4. Sound](04-sound.md)                                              | Music, beat analysis, drum hits, sound effects, ambience and character voices                          |
| [5. Stage, Sequences and Materials](05-stage-sequences-materials.md) | Screen effects, pictures and video, beat-synced timelines, node-graph shaders                          |
| [6. Games inside the story](06-games.md)                             | Rhythm fights, turn-based battles, shops, minigames, and building your own minigame                    |
| [7. Design](07-design.md)                                            | Theme, fonts, colours, title screens, HUDs and panels                                                  |
| [8. Library, Publish and Play](08-library-publish-play.md)           | Reusing work, auto-playtesting, music rights, exporting, the Player, hosting                           |
| [9. Quick reference](09-reference.md)                                | Keyboard shortcuts, the formula language, text markup, troubleshooting                                 |
| [10. World and spaces](10-world.md)                                  | Rooms on a map, exits, the Exits block, and the map and screens readers swipe to                       |
| [11. Beatmaps](11-beatmaps.md)                                       | Aim-and-tap charts: importing .osu/.osz, placing notes to a song, timing, and the Rhythm block         |

## The ten-minute tour

If you only have a few minutes, do this once and you will have touched every important idea.

1. **Start it.** Double-click `run.bat`. The Player opens; the Studio is at
   <http://127.0.0.1:5174>.
2. **Make a novel.** Click the novel's name at the top left, then **New novel**. Pick the
   **Visual novel** kit, keep the suggested look, name it, and press **Create**.
3. **Write.** In **Write**, click into the first narration block and type a sentence. Press
   Enter for a new line. Type `/` on an empty line and pick **Dialogue**; choose a speaker (or
   **New character…**) and write what they say.
4. **Branch.** Type `/` again and pick **Choice**. Write two options. For each option's
   passage pick **New passage…**. You now have three passages.
5. **Look at the map.** Open **Flow**. Your passages are boxes with arrows between them.
   Double-click one to jump back into Write.
6. **Remember something.** Back in Write, inside one branch, add **Change a variable**, pick
   **New variable…** (call it `trust`) and **Add 1**. In the other branch, add an **If** block
   that checks `trust is at least 1`.
7. **Make it move.** Add a **Screen effect** block (Shake) and a **Background** block (rain).
8. **Play it.** Open **Play**. This is exactly what a reader sees. Use **Start over** to try the
   other branch.
9. **Check it.** Open **Publish** and press **Play it for me**. The bot reads your story many
   times and tells you about dead ends.
10. **Ship it.** Still in Publish, choose **Just me** and **Download the novel**. Open the
    Player, tap **Add a novel** on the bookshelf, and choose the file.

## Words used in this guide

- **Novel** (or project): one story, with all its passages, characters, music and settings.
- **Passage**: one page or scene of the story. Choices and jumps lead from passage to passage.
- **Block**: one piece of a passage — a paragraph, a line of dialogue, a choice, a sound.
- **Variable**: something the story remembers, like gold, trust or a name.
- **Workspace**: one of the views in the left rail (Write, Flow, Logic, Sound…).
- **Player**: the reader app. The Studio's **Play** view is the same Player inside the Studio.
- **Kit**: a ready-made starting point for a genre (visual novel, gamebook, mystery…).
