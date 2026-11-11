# 0022 — Polish and publish: playtester, publish check, bookshelf, public builds

**Status:** accepted · 2026-11-11

## Context

Phase 11 (PLAN §13) gets finished novels in front of readers: a bot that finds dead ends, a check
that music may be shared (PLAN §5, §10.1), credits, builds for itch.io and Cloudflare Pages, a
private hosted Studio, an accessibility pass and a performance pass. With more than one novel
around, the Player also needs a way to choose between them.

## Decision

**Auto-playtester.** `PlaytestTally` in `@ie/story` plays seeded random runs through the same
`StoryRuntime` API the Player uses, one run per `play(seed)`, so the Studio runs it in slices of
20 between frames. It reports endings, dead ends (the story ran out without an End block),
softlocks (a choice with nothing to pick), stuck runs (hit the step limit), errors, unseen
passages, unchosen options and number ranges. Fights and minigames are won 6 times in 10.

**Publish check.** `publishCheck(project, story, target, playtest?)` returns items with a code and
params, `block` or `warn`. Public builds: Spotify/YouTube and ND licences block; NC, SA, Audius,
AI and unknown licences warn; a missing credit for a BY licence warns. Story errors and playtest
softlocks block; warnings, dead ends and stuck runs warn. Private builds only check the story.

**Public fallbacks.** A track has an optional `publicFallback` (another track's id).
`applyPublicFallbacks` swaps the fallback's source, licence and analysis in **under the original
id**, so music blocks, sequences and fight songs need no rewriting. `publicBuild` also drops the
tracks that only stood in for others. Charts are in beats, so fights follow the new song.

**Credits** are generated (`buildCredits`) from the tracks a build actually plays, de-duplicated,
then the three bundled fonts (SIL OFL 1.1). The Player shows them under Menu → Credits.

**The novel file is the project JSON** (`.story.json`), downloaded from the Studio's Publish view
with fallbacks applied for a public build. No second format.

**The bookshelf is the Player's main menu.** The bare address shows the shelf; `?novel=<id>` opens a
book. Opening a book is a page load, so each novel starts from a clean reader (no teardown of
fights, stage and audio between novels) and the browser's Back returns to the shelf. Books come
from, in order: `novels/index.json` beside the build (published), files the reader added (kept
in IndexedDB under `novel:<id>`), and, only in a build without published novels, the bundled
sample and kit starters. `{"direct": true}` in the index skips the shelf for a one-novel site.
Covers wear each novel's own theme tokens, scoped to the cover. The row slides with swipe
(scroll-snap), wheel, arrow keys and buttons; work happens only on scroll events.

**Public builds** come from `pnpm publish:novel <files> [--zip] [--pages <project>]`: the normal
Player build plus `novels/`. `--zip` writes an itch.io HTML5 zip (our own writer on `node:zlib`).
`--pages` runs `wrangler pages deploy`. The service worker caches `novels/*.json` stale-while-
revalidate, so published novels read offline. The tool refuses files that still play Spotify or
YouTube. `publish.bat` stays the way to put the bare Player on the `deploy` branch (ADR 0010).

**The private Studio** builds with `pnpm publish:studio [--pages <project>]` into `out/studio`
with a Pages Function for the audio relay (same allowlist as the dev relay) and `noindex`
headers. It must sit behind Cloudflare Access; the script says so before the first deploy.

**Accessibility.** Reader settings for line spacing, plain letters (prose in the sans-serif),
high contrast (muted text and hairlines take full ink; the story's own look is set aside) and
motion (system, less, full). Reduced motion moves to `@ie/core`'s `prefersReducedMotion()` and
`<html data-motion>`, which CSS and every package read, so the in-app choice overrides the system.

**Performance.** The fight and minigame packages load on first use (`LazyRunner`); while one
loads it counts as running, so taps can't skip past the beat. The GPU stage stays eager because
the fight runner and scene sync depend on its host.

## Consequences

- Anything that plays a track must refer to it by id; never copy a track's source elsewhere, or
  fallbacks won't reach it.
- New publish rules are new `PublishCode`s with strings in both languages.
- A published site is static files only; there is no server-side list of novels.
- New Player code that needs reduced motion asks `prefersReducedMotion()`, never the media query.
