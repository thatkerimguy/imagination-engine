# 7. Design

**Design** sets how the novel looks to readers: the **Theme**, and the **Screens** around the
story.

## Theme

- **Preset**: the starting point.
  - **Auto** follows each reader's own Paper or Night setting, which is usually the kindest
    choice.
  - The others are Paper, Night, Terminal, Noir, Neon, Parchment and Static.
- **Colours**: change background, surface, lines, text, quiet text, faint and accent. **Use the
  preset's colour** puts one back. If a colour is hard to read against the background, a
  warning shows the contrast and what it needs. Fix those, because some readers can't read
  low-contrast text.
- **Type**:
  - **Story font** and **Interface font**: from the preset, Serif (Literata), Sans (Inter) or
    Mono (JetBrains Mono). All three have every Turkish letter.
  - **Text size** and **Line spacing**.
- **Choices**: how options look: Outlined, Filled, Underlined or Plain.
- **New page**: how a new page appears: Appears, Fades in or Rises in.
- **Preview** shows a sample page with your settings.

Readers can still make text bigger, widen spacing, raise contrast and reduce motion in their
own settings. Your theme is the default, not a cage.

## Screens

Screens are what surrounds the story. There are three kinds:

- **Title screen**: shows before the story starts. Usually the title, a **Start** button and a
  **Continue** button. Only the first title screen is used.
- **HUD**: stays on screen while reading, **Above the page** or **Below the page**. For example,
  a heart bar for HP and a coin count.
- **Panel**: opens from a button, or from the reader's menu. For example, a map, a codex or an
  endings gallery.

### Building a screen

**Add screen**, pick the **Kind**, then **Add to screen**:

| Piece  | What it is                                                        | Settings                                                           |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Stack  | Puts things in a row or a column                                  | direction (down/across), spacing, align                            |
| Grid   | Puts things in columns                                            | columns, spacing                                                   |
| Text   | Words that can show variables                                     | the words, style (title, heading, body, caption)                   |
| Bar    | A meter for a number variable                                     | the variable, full at (a number or another variable), label        |
| Icon   | A small picture                                                   | heart, coin, star, key, clock, book, magnifier, message, map, bolt |
| List   | Items carried, quests, stats, endings reached, or a list variable | what to show, text when empty                                      |
| Button | Does something when pressed                                       | its label and **When pressed** actions                             |
| Tabs   | Pages the reader switches between                                 | add or remove tabs                                                 |

A button's actions can be:

- **Start the story** or **Continue from the last save** (title screens only);
- **Open a screen** (one of your panels) or **Close this screen**;
- **Open a reader panel**: Settings, Saves, History or Character sheet;
- **Change a variable**.

Every piece has **Only when**, a condition, so a "Key" icon can appear only once the key is
carried. Use **Move up** and **Move down** to reorder pieces.

**Preview** shows the screen with the story's starting values.

## Layouts

The novel's default layout comes from the kit (page, text box or chat). Each passage can change
it in **Passage settings → Layout** (chapter 2), so one chapter can be a chat log inside a page
story.
