# 8. Library, Publish and Play

## Library: reuse across novels

The **Library** belongs to this device, not to one novel. It keeps effects, sequences,
materials, enemies, themes and screens you want to use again.

- **Save from this novel**: choose **What to save**, give it a **Name in the Library**, then
  **Save to Library**.
- **In the Library**: everything saved, filtered by kind with **Show**.
  - **Add to novel** puts a _copy_ in the open novel. Changing the copy never changes the
    Library.
  - An effect is added at the end of the passage open in Write.
  - **Rename** and **Remove from Library** are here too. Novels that use a copy keep it.
- **Packs**: a pack is a file of Library items, for moving them to another device or sharing
  them.
  - **Export pack** saves what is shown above.
  - **Import pack** adds the items from a pack file.

## Play: read it like a reader

**Play** runs the novel in the real Player, inside the Studio.

- **Start over** restarts from the beginning; **Back** steps back.
- **From: …** shows where you started. **Play from the story start** resets it after using
  **Play from here** on a passage (from Write or Flow).
- **Reading language** switches between English and Turkish.
- If the story has errors, Play lists them under **Fix these to play** instead of starting.

## Publish

**Publish** gets a novel ready for other people.

### Auto-playtester

A bot plays the novel from the start with random choices, as many **Runs** as you ask. Fights
and minigames are won about 6 times in 10. Press **Play it for me** and you get:

- the **Endings reached**, and how often;
- **Stuck at a choice with nothing to pick**: every option was hidden or locked;
- **The story ran out without an End block**;
- **Runs that never ended**: probably a loop;
- **Errors**;
- **Passages no run reached**, and options that were never picked;
- **Number variables seen**: the lowest and highest each one reached. Gold going to −40 means a
  missing check.

Click a spot to see where it happened.

### Publish check

Choose who the build is for:

- **Just me**: for your own phone. Anything goes, Spotify and YouTube included.
- **Public**: for itch.io or a public site. Songs that have a **public replacement** are swapped
  for it.

The check lists anything that stops the build (red) or deserves a look:

- story errors and warnings;
- the playtester's dead ends and stuck choices (run it first);
- songs that can't be shared;
- licence limits:
  - ND can't be cut and looped;
  - NC means don't sell the novel;
  - SA means the novel must use the same licence;
- a missing artist credit;
- a novel too large for mobile data.

For each song, set its **Licence**:

- Not sure;
- My own music;
- CC0;
- CC BY, CC BY-SA, CC BY-NC or CC BY-ND;
- Made with AI.

Also set its **Public replacement**, for example a CC0 song to use instead of your Spotify
track. **Credits the Player will show** previews the credits page.

When it says **Ready to publish**, press **Download the novel**. You get a `.story.json` file.

### Getting it to readers

- **Your own phone**: open the Player, tap **Add a novel** on the bookshelf, and choose the
  file. It stays on that device.
- **A public site or itch.io**: on the computer, run
  `pnpm publish:novel path\to\novel.story.json`. It builds a Player with your novel on its
  shelf. Add `--zip` for an itch.io upload, or `--pages <name>` to put it on Cloudflare Pages.
- **This project's own Player site**: `publish.bat` merges your work into `main` and pushes a
  fresh Player build to the `deploy` branch.

## The Player, as readers see it

- **Bookshelf**: drag (or swipe) to browse; tap the book in the middle to open it, and tap a
  book at the side to bring it to the middle. A cover picture shows if you set one.
- **Reading**: tap to continue. The menu has:
  - **History** — tap a past choice to **go back to** it;
  - **Saves** — slots, plus an automatic save after every step;
  - **Character** — stats, inventory and journal;
  - **Settings**;
  - **Credits**;
  - **Full screen**.
- **Reader settings**:
  - language and theme;
  - timed choices on or off;
  - vibration;
  - volumes (all, music, ambience, effects, voices);
  - line spacing and letters (book or plain);
  - contrast;
  - motion.

## Hosting the Studio online

You can put a private copy of the Studio on the internet, so you can use it from your phone
anywhere. Cloudflare Access keeps everyone else out. The repository has everything it needs
(`wrangler.jsonc`, ADR 0030).

### One-time setup in Cloudflare

1. Go to **Workers & Pages → Create → Import a repository** and pick
   `thatkerimguy/imagination-engine`.
2. Fill the form:
   - **Project name**: `imagination-engine`.
   - **Build command**: `pnpm publish:studio`. This is not `pnpm run build`; it builds the Studio
     the way Cloudflare can host it.
   - **Deploy command**: `npx wrangler deploy`.
   - **Enable Preview builds**: off. Preview addresses aren't covered by your Access rule.
   - **Protect with Cloudflare Access**: on. Allow only your own e-mail address.
   - Under advanced settings, add the variable `NODE_VERSION` = `24` if the build complains
     about Node.
3. Deploy. Cloudflare builds the branch it's set to, usually `main`, so run `publish.bat` first
   to get your latest work there. After that, every push to `main` redeploys.

### Device sync online (optional)

Sync needs storage on Cloudflare:

1. In R2, create a bucket called `imagination-sync`.
2. In `wrangler.jsonc`, remove the `//` in front of the `r2_buckets` line.
3. Push the change.

Until then, the Studio works but **Device sync** says there's no sync store.

### Good to know

- Beat analysis and drum hits load one large file from a public CDN (jsDelivr) the first time,
  because Cloudflare won't host files over 25 MB. After that they work offline.
- Your novels live on each device. Sync copies them between devices; it isn't a backup, so keep
  exporting important novels.
