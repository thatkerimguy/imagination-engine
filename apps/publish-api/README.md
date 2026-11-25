# @kn/publish-api

A tiny Cloudflare Worker that accepts authenticated publishes from `apps/writer` and serves the
published book (static JSON + cover) from an R2 bucket. No database, no reader login.

## Routes

| Method    | Path                                                | Auth               | Purpose                                                                   |
| --------- | --------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| GET       | `/api/health`                                       | no                 | `{ok:true,version:1}`                                                     |
| GET       | `/api/verify`                                       | bearer             | Check the token                                                           |
| PUT       | `/api/novels/:id`                                   | bearer             | Validate with `@kn/core`, write, sweep stale objects                      |
| DELETE    | `/api/novels/:id`                                   | bearer             | Remove the book and its index entry                                       |
| GET, HEAD | `/novels/*`                                         | no                 | Public read of `index.json`, `novel.json`, chapters                       |
| OPTIONS   | `*`                                                 | no                 | CORS preflight                                                            |
| POST      | `/api/reports`                                      | no                 | Abuse report (JSON or HTML form), 5/min per IP                            |
| GET       | `/api/moderation/reports`                           | `MODERATION_TOKEN` | List pending reports                                                      |
| POST      | `/api/moderation/takedown`                          | `MODERATION_TOKEN` | Tombstone + delete a novel                                                |
| DELETE    | `/api/moderation/takedown/:slug`                    | `MODERATION_TOKEN` | Clear a tombstone                                                         |
| GET       | `/legal/terms`, `/legal/privacy`, `/legal/takedown` | no                 | Static legal pages + report form                                          |
| GET       | `/share/:slug` (alias `/r/:slug`)                   | no                 | Open Graph share page (needs `PUBLIC_READER_URL` to redirect)             |
| GET       | `/og/:slug.png`                                     | no                 | Generated 1200x630 preview image                                          |
| GET       | `/.well-known/assetlinks.json`                      | no                 | Android App Links (`ANDROID_PACKAGE`, `ANDROID_SHA256_CERT_FINGERPRINTS`) |

Publish routes are limited to 30 requests/min per IP (`PUBLISH_LIMITER`); reports to 5/min
(`REPORT_LIMITER`). Without the bindings an in-memory limiter is used. Exceeded => 429 + `Retry-After: 60`.

## Moderation and takedown

`MODERATION_TOKEN` is a separate secret (`wrangler secret put MODERATION_TOKEN`); unset => 503, and
`PUBLISH_TOKEN` is never accepted. A takedown writes `takedowns/<slug>.json`, deletes `novels/<slug>/`
and unlists it. Afterwards `/novels/<slug>/*`, `/share/<slug>` and `/og/<slug>.png` answer 410 and
the author's `PUT /api/novels/<slug>` is refused with 410. To allow publishing again:

```sh
curl -X DELETE -H "Authorization: Bearer $MODERATION_TOKEN" https://<worker>/api/moderation/takedown/<slug>
```

### Optional moderation webhook

Set `wrangler secret put MODERATION_WEBHOOK_URL` (a Discord or Slack incoming-webhook URL) to be
alerted on each new report. It is optional and non-blocking: when unset or blank nothing happens;
otherwise the Worker POSTs after the `201` is decided (via `ctx.waitUntil`, 5 s timeout). Failures
(network, timeout, non-2xx) are only logged and never affect the reporter's response.

```json
{
  "content": "New abuse report (spam) on <novel> / <chapter>
<details preview>
Report id: <id>",
  "text": "<same as content, for Slack>",
  "reportId": "...",
  "novelSlug": "...",
  "chapterSlug": "...",
  "reason": "spam",
  "detailsPreview": "first 240 chars, truncated with an ellipsis",
  "createdAt": "2026-01-02T03:04:05.678Z"
}
```

The reporter's IP and its hash are never sent.

An unset or empty `PUBLISH_TOKEN` makes every authed route answer 503; it is never open.

## Local development

```sh
PORT=8787 PUBLISH_TOKEN=dev-token pnpm --filter @kn/publish-api dev:local
```

Runs a `node:http` server over an in-memory store (data is lost on exit) and prints
`publish-api listening on http://127.0.0.1:<port>`.

## Deploy to Cloudflare

From `apps/publish-api`:

```sh
wrangler r2 bucket create kinetic-novels
openssl rand -base64 32          # generate a token
wrangler secret put PUBLISH_TOKEN
wrangler deploy
```

Deploy the reader pointing at the Worker's public route:

```sh
VITE_NOVELS_BASE_URL=https://<worker>/novels/ pnpm --filter @kn/reader build
```

Optionally attach an R2 custom domain to the bucket and use that as `VITE_NOVELS_BASE_URL`
instead of the Worker's `/novels/` route.

## Writer setup

In `apps/writer`: Settings -> Publishing. Enter the API URL (the Worker origin), the token, and the
public reader URL.

## Chapter lifecycle

- `published`: written and listed in `season.json`; the book appears in `novels/index.json`.
- `unlisted`: written but not listed; readable by direct link only.
- `draft`: never written, and deleted from storage if it was previously published.

A book with no published chapters is not on the public shelf. A book with no published or unlisted
chapters is removed entirely. Every publish deletes any object under `novels/<id>/` it did not just
write (including the cover if the request omits it).
