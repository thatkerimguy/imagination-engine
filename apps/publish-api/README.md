# @kn/publish-api

A tiny Cloudflare Worker that accepts authenticated publishes from `apps/writer` and serves the
published book (static JSON + cover) from an R2 bucket. No database, no reader login.

## Routes

| Method    | Path              | Auth   | Purpose                                              |
| --------- | ----------------- | ------ | ---------------------------------------------------- |
| GET       | `/api/health`     | no     | `{ok:true,version:1}`                                |
| GET       | `/api/verify`     | bearer | Check the token                                      |
| PUT       | `/api/novels/:id` | bearer | Validate with `@kn/core`, write, sweep stale objects |
| DELETE    | `/api/novels/:id` | bearer | Remove the book and its index entry                  |
| GET, HEAD | `/novels/*`       | no     | Public read of `index.json`, `novel.json`, chapters  |
| OPTIONS   | `*`               | no     | CORS preflight                                       |

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
