# 0010 — Hosting the Player from a deploy branch

**Status:** accepted · 2026-11-09

## Context

Some novels get published. Hosts such as GitHub Pages, Netlify or Cloudflare Pages can
serve a branch of the repository, often from a sub-folder (`/imagination-engine/`). The Studio is a
private tool and stays on this PC.

## Decision

**`publish.bat` pushes the Player build to an orphan `deploy` branch** that holds only the files
a host needs: `index.html`, assets, icons, manifest and service worker. It has no source,
no source maps and no shared history with `main`. Each publish is one commit naming the source
commit. The script works in a temporary git worktree (`.deploy/`), so the working tree is never
touched. The branch has `.nojekyll` (serve files as built) and `* -text` (no line-ending changes).

**The Player builds with relative paths** (`base: './'`, manifest `start_url`/`scope` `./`), so the
same build works at a domain root or in any sub-folder. The manifest `id` stays `/`, so copies
already installed keep their identity.

## Consequences

- New Player code must not use root-absolute URLs (`/foo`); use relative paths or Vite imports.
- The Player stays a single page: deep links would need a host rewrite to `index.html`.
- Publishing the Studio later would need its own base and a sub-folder on the branch.
