# 0012 — Audio: mixer, scene state, sources and sync

**Status:** accepted · 2026-11-10

## Context

Phase 3 (PLAN.md §5, §13) brings sound: music from many sources with beat sync, sound effects,
dialogue voices and ambience, all driven from the story and edited in the Studio without code. The
plan names the sources and the sync goal; it leaves open how sound fits the runtime, saves and
rewind, how the Studio reaches catalogue audio from the browser, and how far Spotify and YouTube go.

## Decision

**A new framework-free package, `@ie/audio`.** It holds the mixer, music, sfxr, voices, ambience,
beat analysis (ADR 0013), the conductor and the catalogue and streaming adapters. The novel's
sound data (tracks, sounds, voices, action params) lives in `@ie/story` with Zod schemas, so the
Player, the Studio and the validator share one definition.

**One Web Audio graph, five buses.** `AudioEngine` has music, ambience, sfx, voice and ui buses
into a master gain. Music and ambience pass through a muffle filter, and each bus has a duck gain.
Volumes are squared so sliders feel even. The context starts on the first tap or key, because
browsers block audio until then. The host gets a callback at that point and restarts whatever the
story says should be playing. Reader volumes are per-device Player settings.

**Music streams through media elements.** A song never sits decoded in memory, which matters on the
reference phone. Elements go through the mixer when the server allows CORS. Otherwise their own
volume follows the music bus, without the muffle. The element clock is coarse, so it is a
non-exact clock source for the conductor.

**Sound is driven by action blocks, and `.set` actions are scene state.** Story blocks run
`audio.music.set`, `audio.ambience.set` and `audio.sfx.play` through the kernel's action bus, like
any module. The runtime records the params of every action ending in `.set` under
`StoryState.scene`, keyed by action and `slot`. Saves and rewinds therefore carry the soundscape,
and after a load, rewind, back or restart the host calls `AudioDirector.applyScene`. Events
(`.play`) are not remembered. Old saves without `scene` load as silence.

**Small, file-free sound for a published novel.** Sound effects are sfxr parameter sets of a few
dozen numbers, made in the Studio from presets. Ambience (rain, wind, room, crowd, fire) is
procedural: each layer is rendered once into a seamless 8-second loop at 22.05 kHz. Dialogue
voices are a short tone every few letters (at most one per 45 ms), set per character. The
presenter reports typed text through an optional `PresenterHost.typed` hook, so the presenter
needs no audio code.

**Sources.**

- *Files:* the Studio copies imported audio into OPFS (`imagination-studio/audio/<id>.<ext>`); the
  track holds the path. Removing a track keeps the file, so Undo works. A published novel can't
  reach the Studio's OPFS, so the Player plays URL tracks only until publishing bundles files.
- *Catalogues:* Openverse and Audius need no key. Jamendo needs a client ID that the author enters,
  stored per device. Results carry their licence, and the Studio labels each as free to publish,
  publish with credit, check the licence, or private only, using the table in PLAN.md §5.
- *Catalogue audio for analysis:* fetched directly when the host sends CORS headers. Otherwise it
  goes through `/fetch?url=`, a relay inside the Studio's Vite dev and preview servers (127.0.0.1
  only, GET only, allowlisted catalogue hosts, 60 MB cap). It isn't part of any production
  build. A hosted Studio would need a small worker in its place.
- *Spotify and YouTube:* private playthroughs only, flagged as such on the track. YouTube uses
  the IFrame API with the player visible. Spotify uses PKCE sign-in (no secret) with the author's
  own client ID and the Web Playback SDK, which needs Premium. Tokens stay in IndexedDB on the
  device. The redirect URI is the Studio's own address, shown in Sound → Setup. The plan said
  `127.0.0.1:5173/callback`, but tap calibration happens in the Studio.

**Sync for sources without audio is tap calibration.** The author taps on a downbeat and then on
every beat. A least-squares fit gives BPM and offset, stored as `TrackCalibration`, and a device
tap-latency test is subtracted. The conductor smooths coarse remote clocks: it extrapolates from
the wall clock, eases 10% towards each report, and jumps on drifts over 0.25 s (a seek or a
stall). ReccoBeats BPM lookup and Spotify Connect control from the phone are left for later.

## Consequences

- Sound restores exactly on load and rewind with no extra save format, and Play in the Studio
  behaves like the Player.
- A novel can ship with no audio files at all: sfxr, voices and ambience are data and code.
- The CORS relay ties catalogue analysis to running the Studio from its own servers, which is how
  it is used today.
- Spotify sign-in and Web Playback, and the YouTube player, are built but not yet tried with a
  real account. They need the owner's client ID and sign-in.
