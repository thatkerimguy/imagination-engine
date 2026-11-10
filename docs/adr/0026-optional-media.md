# 0026 — Optional media: a picture or a muted video behind the text

**Status:** accepted · 2026-11-11

## Context

PLAN §6.2 says images, video and 3D can be added later as modules, and that core features never
depend on them. Authors want a scene to have a picture behind it now and then. The reference phone
(Redmi Note 12, Adreno 610) already runs the GPU stage over the text, and novels are single JSON
files that sync between devices (ADR 0024) and publish as static sites (ADR 0022).

## Decision

**Two scene actions in a separate package.** `media.image.set` and `media.video.set` are ordinary
action blocks (schemas in `@ie/story`, `MEDIA_ACTIONS`); `@ie/media` holds the `MediaLayer` and
`createMediaModule`. Like the other `.set` actions they are scene state, so a picture comes back
after a load, a rewind or a restart. A host without the module ignores them; nothing else in the
engine reads them.

**One layer, behind the text.** The layer is a single element made the first time a scene shows
media and removed when it shows none, so novels without media pay nothing. It sits under the page
(and under the GPU stage), never takes input, and has a veil in the page colour (`--color-bg`) over
it: the author picks how strong (0–90 %, 55 % by default), and the text keeps its contrast in both
themes. Size is "fill the screen" (`cover`) or "show it whole" (`contain`). A video set while a
picture is set covers it; stopping the video shows the picture again.

**Pictures live in the novel; video is linked.** A picture is either an `https` address or an
inline data URL (WebP, JPEG or PNG, at most `MEDIA_INLINE_MAX` = 600 000 characters). The Studio
shrinks a chosen file in the browser (1600 px on the long side, lower sizes and qualities until it
fits) so the novel stays one file that syncs and publishes as it is. Videos are `https` addresses
only: they are too large to keep in the JSON. Other schemes (`http`, `javascript:`, SVG data) are
refused by the schema.

**Video is always muted and stills under reduced motion.** Sound belongs to the audio blocks and
their mixer (ADR 0005), and autoplay with sound is blocked on phones anyway. With reduced motion
the video shows its first frame and pauses, and follows the setting when it changes.

**Pictures can carry words** (`alt`, in both languages) for readers who can't see them; videos are
decoration and hidden from assistive technology.

**3D is left out.** The reference phone's GPU budget goes to the stage; a 3D module would be its own
ADR.

## Consequences

- An unreachable picture or video removes itself; the page stays as it was.
- Inline pictures make novel files larger; the size limit keeps one picture under about 450 KB of
  image data.
- A sequence (ADR 0019) can't show media yet; the sequencer would need a media track.
