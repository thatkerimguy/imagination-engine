# 1. Getting started

## Opening the Studio

### On this computer

- **Easiest:** double-click `run.bat` in the project folder. It installs what's needed the first
  time, starts both apps and opens the Player. If they're already running in another window,
  it just opens the Player again.
- The **Studio** lives at <http://127.0.0.1:5174>, the **Player** at <http://127.0.0.1:5173>.
- `run.bat preview` builds the real, installable versions and serves them on ports 4173 (Player)
  and 4174 (Studio). Use it to test offline installs.
- From a terminal, `pnpm dev` does the same as `run.bat`.

Both are installable apps (PWAs): in Edge or Chrome, use the install icon in the address bar to
get a Studio window of its own.

### On the phone, by cable

Plug the phone in with USB debugging on and run `pnpm phone`. It connects the phone to this
computer's servers and opens the Player on it. Add `--studio` to open the Studio instead,
`--preview` for the built version, `--hud` for the performance overlay.

### On the phone, without a cable

The dev servers deliberately only listen on this computer, so a phone on Wi-Fi can't reach
them. For wireless use, put the Studio online privately (see
[chapter 8 → Hosting the Studio](08-library-publish-play.md#hosting-the-studio-online)). Then open
your Studio address on the phone, sign in once through Cloudflare Access, and install it from
the browser menu. Turn on **Device sync** (below) so the phone and computer share the novel.

## The screen

- **Left rail** (computer) or **bottom tabs** (phone): the workspaces. On the phone, Write, Flow
  and Play are tabs, and everything else is under **More**.
  - **Write** — the story as a document.
  - **Flow** — the story as a map.
  - **Logic** — rules and routines.
  - **Sound** — music, beats, sound effects, voices.
  - **Stage** — try the GPU effects.
  - **Sequences** — timelines on the beat.
  - **Materials** — node-graph effects.
  - **Design** — theme and screens.
  - **Data** — characters, variables, items, enemies, quests.
  - **Library** — reusable pieces across all novels.
  - **Publish** — playtest, rights check, export.
  - **Play** — read it like a reader.
  - **Settings** and **Diagnostics** sit at the bottom.
- **Top bar:** the novel's name (click it for the novel sheet), **Undo**, **Redo**, the
  **command palette**, the language switch (English/Turkish interface), and the theme switch
  (Paper/Night). It also shows whether your work is **Saved**.
- **Command palette:** `Ctrl+K` (or the search icon). Type a few letters of a workspace or a
  setting and press Enter. It's the fastest way around.

## Novels

Click the novel's name in the top bar to open the **novel sheet**:

- **Title (English)** and **Title (Turkish)**.
- **Bookshelf cover** — optional. Add a picture to show on the shelf; without one, the shelf draws
  a cover from the title. **Use the title cover** removes the picture.
- **Kits** — which kits this novel was made from, and **Add a kit** to bring in another kit's
  variables, characters, items and screens. Your story and theme stay as they are.
- **New novel** — opens the three-step wizard (below).
- **Open the sample** — _The Rain Alley_, a small finished story to learn from.
- **Import file** / **Export file** — a novel is one `.story.json` file. Export it to back it
  up or move it; import a file to open it.
- **Novels on this device** — every novel you have here. Click one to switch to it.

### The new-novel wizard

1. **What kind of story?** Pick a kit, or **Blank** for one empty passage.
2. **How should it look?** A theme preset. The kit suggests one.
3. **Name and languages.** The title, and whether it's English and Turkish, English only, or
   Turkish only.

### The kits

| Kit                     | What you get                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Visual novel            | Characters talk in a box at the bottom; a title screen, two endings and an endings gallery |
| Gamebook                | Book pages, dice checks, stats, a pack and an adventure sheet; a HUD with stamina and gold |
| Chat story              | A story told in text messages, with typing delays and replies to pick                      |
| Mystery                 | Search for clues, keep them in a journal, accuse a suspect once the evidence is in         |
| Text RPG                | Stats, levels, items, skills, quests and a shop, with turn-based or rhythm combat          |
| Rhythm action           | Fights on the beat against rivals with their own moves and scores                          |
| Explorer                | Rooms joined by exits, objects to take and use, and Look/Take/Use/Talk on every page       |
| Horror                  | Sanity that slips, screen effects that grow with it, text that stops being reliable        |
| Kinetic poetry          | Large moving titles, pauses and stage changes carrying short lines of verse                |
| Roguelite               | Runs through a deck of random encounters, with unlocks that carry over                     |
| Social and romance      | Affinity with each character, a calendar, gifts and scheduled events                       |
| Survival and management | Resources to balance, days that pass, random events each night                             |
| Terminal                | A terminal look, choices as commands, and a hacking minigame                               |

A kit is only a starting point. Open its passages in Write to see how each trick is built, then
change anything.

## Saving, undo and history

- Everything saves **automatically** on this device, a moment after each change. The top bar
  says **Saving…**, then **Saved**. **Not saved** means the browser refused; export the novel to
  be safe. **Can't save this change** means the last edit went past one of the story's limits;
  the copy from before it is kept. Undo that edit and saving goes on.
- **Undo** `Ctrl+Z`, **Redo** `Ctrl+Y` (or `Ctrl+Shift+Z`). Undo covers every edit in every
  workspace.
- Novels live in the browser's storage on this device. Clearing the browser's site data deletes
  them. **Export file** now and then is your backup.

## Device sync

**Settings → Device sync** keeps the open novel the same on your phone and computer.

- It works on the hosted Studio (and on this computer's dev server for testing).
- **Sync now** syncs immediately; it also syncs on its own after changes.
- If the same thing was changed on both devices, this device's version is kept and the
  message says how many values were affected.
- **On other devices** lists novels that exist elsewhere; **Open here** brings one over.
- It shows **No sync store here** when the site has no storage set up (see chapter 8).

## Settings and Diagnostics

- **Settings** (this device only): interface language, theme (System/Paper/Night), the
  performance overlay, and Device sync.
- **Diagnostics**: what this device and browser can do — GPU, refresh rate, WebGPU, storage.
  **Copy report** puts it on the clipboard, which is useful when something only fails on the phone.
