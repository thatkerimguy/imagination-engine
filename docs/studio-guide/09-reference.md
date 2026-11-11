# 9. Quick reference

## Keyboard shortcuts

| Where           | Keys                                    | Does                                                         |
| --------------- | --------------------------------------- | ------------------------------------------------------------ |
| Anywhere        | `Ctrl+K`                                | Command palette                                              |
| Anywhere        | `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`) | Undo / Redo                                                  |
| Write           | `/` in an empty line                    | Block picker; type to filter, `Enter` to add, `Esc` to close |
| Write           | `Enter`                                 | New line below                                               |
| Write           | `Alt+↑` / `Alt+↓`                       | Move the block up / down                                     |
| Script view     | `Ctrl+Enter`                            | Apply the script                                             |
| Flow            | double-click / right-click              | Open in Write / play from here                               |
| Flow, Materials | `Ctrl` + wheel, middle-drag             | Zoom, move around                                            |
| Materials       | `Esc` or right-click                    | Let go of a wire                                             |
| Sequences       | `Space`                                 | Play / pause                                                 |
| Sequences       | `J` / `L`, `K`                          | Step a beat back / forward, stop                             |
| Sequences       | arrows, `Delete`                        | Nudge, remove the selected clip                              |
| Fights (Player) | `F` `J` `Space` `Z` `X`                 | Tap (strike, parry)                                          |
| Fights (Player) | `D` `K` arrows                          | Swipe (dodge)                                                |
| Player          | edge arrows / `Esc`                     | Open a space beside the story / back to the story            |

On a Mac, use `⌘` where it says `Ctrl`.

## Formulas

You can always use dropdowns instead, but formulas are quicker for maths. They appear in
conditions (**Formula** mode) and in values.

- **Names** of variables as they are: `gold`, `trust`, `max_hp`.
- **Numbers and text**: `10`, `2.5`, `"Mira"`. **Yes/No**: `true`, `false`.
- **Maths**: `+ - * / %` and brackets: `(gold - 10) * 2`.
- **Compare**: `==` `!=` `<` `<=` `>` `>=`.
- **Logic**: `and`, `or`, `not`: `trust >= 2 and not warned`.
- **Functions**:

| Function                                    | Means                                    |
| ------------------------------------------- | ---------------------------------------- |
| `min(a, b, …)`, `max(a, b, …)`              | Smallest / largest                       |
| `clamp(x, low, high)`                       | Keep x between low and high              |
| `abs(x)`, `round(x)`, `floor(x)`, `ceil(x)` | The usual rounding                       |
| `random(low, high)`                         | A random whole number from low to high   |
| `visited("passage")`                        | How many times a passage was visited     |
| `chosen("option")`                          | Whether an option was picked before      |
| `has(list, value)`                          | Whether a list variable contains a value |
| `len(list)`                                 | How many things a list holds             |
| `owned("item")`                             | How many of an item the reader carries   |
| `quest("quest")`                            | A quest's status                         |

Examples:

- `clamp(hp + 5, 0, max_hp)` heals 5 without going over the maximum.
- `visited("p_alley") > 1` is true the second time someone comes back.

`visited`, `chosen`, `owned` and `quest` take the thing's ID, not its name. The easy way to get
it right is to build the condition with dropdowns first, then switch to **Formula** to see it
written out.

## Text markup

The text tools write these for you. This is only so you recognise them in the Script or
Translate views.

| You see                                        | Means                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `{gold}`                                       | The value of a variable                                                                          |
| `{@mira}`                                      | A character's name                                                                               |
| `{@mira}'e`                                    | The name with a Turkish suffix that follows its sounds                                           |
| `{gold, plural, one {# coin} other {# coins}}` | Words that change with a number                                                                  |
| `[shake]…[/shake]`                             | An effect: `shake`, `tremble`, `wave`, `whisper`, `shout`, `fade`, `scramble`, `b`, `i`, `color` |
| `[pause=400]`                                  | Pause the typewriter for 400 milliseconds                                                        |
| `[[`, `]]`, `{{`                               | A literal `[`, `]` or `{`                                                                        |

## Problems you may meet

| What you see                                    | What to do                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| **Not saved** in the top bar                    | The browser refused storage (private mode, full disk). Export the novel now      |
| Play shows **Fix these to play**                | Click each problem to jump to it; they're story errors                           |
| "Nothing leads to …"                            | No choice or jump reaches that passage. Link to it, or delete it                 |
| "… can run out without going anywhere"          | Add an End, a Go to, or a choice at the end of the passage                       |
| A fight plays a drum loop                       | The song has no beat grid. Analyse it, or tap along in Sound                     |
| Beat analysis says it used the built-in tracker | Beat This! couldn't run (no model, or a phone). Download the model on a computer |
| The stage stays blank                           | The browser has no WebGL2. The story still works; try Diagnostics                |
| Taps in fights feel late                        | Run **Sound → Setup → Tap timing** on that device                                |
| Device sync says **No sync store**              | The hosted Studio needs an R2 bucket (chapter 8)                                 |
| "An exit leads nowhere yet"                     | In World, pick where the exit leads, or remove it                                |
| `run.bat` says a port is busy                   | Another program uses port 5173 or 5174. Close it, or restart the computer        |
| The Studio looks old after an update            | It's an installed app. Close every Studio tab and window, then open it again     |

## Where things are stored

- **Novels**: in this browser, on this device. Use **Export file** for backups, and **Device sync**
  to share them between devices.
- **Library**: in this browser, on this device. Use **Export pack** to move it.
- **Settings** (theme, language, overlay): this device only.
- **Downloaded models** (Beat This!, drum hits): this device only. Remove them under Sound →
  Setup.
