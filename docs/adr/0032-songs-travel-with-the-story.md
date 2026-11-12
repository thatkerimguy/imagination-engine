# 0032 — Imported songs travel with the story

**Status:** accepted · 2026-11-12

## Context

A song imported into the Studio is a `file` track: the audio sits in this device's OPFS under
`audio/<trackId>.<ext>` and the story only names the path. Three things broke because of that:

- `MusicPlayer` revoked the object URL it was given when a song stopped, but the Studio's resolver
  caches one URL per stored file and hands it out again, so a local song played once and then
  stayed silent everywhere (Sound, Play, fights).
- A published `.story.json` named a path that exists only on the author's device, so the Player
  had nothing to play.
- Device sync (ADR 0024) carried the story but not its songs.

## Decision

**The resolver owns any object URL it makes.** `MusicPlayer` only reads the URL from
`TrackResolver`; it never revokes it. A resolver that caches URLs keeps them for the session.

**A downloaded novel carries its songs inside it.** When the Studio downloads a novel file, every
`file` track becomes a `url` track holding a `data:` URL of the stored audio, with its MIME type.
Songs that aren't on this device are named in a warning, and the file is still written. Credits
never print a `data:` URL; they use the licence or source page instead.

**Device sync carries song files beside projects.** The store gains
`HEAD|GET|PUT /sync/files/audio/<name>` on the dev middleware and the hosted function. Names are
unique per import, so a file is written once and never replaced (no ETags). On opening a story,
the Studio uploads songs the store lacks, downloads songs this device lacks, and remembers which
paths it has already checked. A song neither side has is counted, and Sync settings say so. The
hosted Worker refuses `/fetch` without Cloudflare Access's header, like `/sync`, unless
`RELAY_OPEN` is `"1"`.

## Consequences

- Novel files with songs grow by about 4/3 of the audio size. That's acceptable for private
  reading and itch.io zips; a later ADR can split audio into separate files if needed.
- Sync storage keeps every song ever synced. Nothing deletes old songs yet.
- A song larger than 60 MiB doesn't sync.
