# Stash

**English** | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

**Photos and messages from your chats, kept in one place.** A self-hosted, single-user inbox that receives messages from chat-platform bots and saves them, with every image and file downloaded into your own storage. It runs entirely on Cloudflare Workers + D1 + R2 + Queues and fits the free plan for personal use. QQ is supported first; the platform layer is built so Telegram and others can be added.

## Features

- **QQ bots**: add a bot on the QQ Open Platform, paste its AppID / AppSecret into Settings and the webhook URL Stash shows into the QQ console. Stash answers the callback URL check (op 13) and verifies the Ed25519 signature of every event. Direct messages, group messages (with or without an @) and channel messages are stored; a redelivered event is stored once. Each bot can have its own picture (the QQ Bot icon otherwise)
- **Reliable file saving**: the webhook only writes the message to D1 and queues its attachments, so QQ gets its answer quickly. A queue consumer streams each file into R2 without buffering it, so files of tens or hundreds of MB fit (known length: one streamed PUT; unknown length or over 5 GB: multipart upload in 10 MB parts), and checks the stored size against `Content-Length`
- **Retries**: network errors, timeouts, truncated downloads, 408 / 429 / 5xx are retried 9 times, backing off from 30 seconds to 2 hours (about 5 hours in total, within the free plan's 24-hour queue retention). Expired links (other 4xx) fail at once. A dead-letter queue catches consumers that crash, and a sweep every 10 minutes re-queues attachments whose queue message was lost or whose download died. Failed files can be retried one by one or all at once from the web app
- **Platform-neutral**: each chat platform is an adapter on the API and one entry in the web app's platform registry; pages, storage and the queue don't know which platform a message came from
- **Web app**: a feed of messages with image thumbnails, a full-size viewer (images, video, audio) and downloads; filter by bot, "with files" or "failed"
- **Task queue**: every download with summary tiles (saved, storage used, in progress, failed), filters by status, type and bot, per-task details (sizes, attempts, error, next retry, source URL, R2 key) and retry
- **Event log**: every webhook call is kept (30 days by default), hits (saved as a message, or a redelivery) and misses (ignored events, URL checks, rejected calls such as a bad signature or unknown bot, storage errors), with the raw payload. QQ event names are translated; new ones show their raw name
- **AI analysis** (optional, with the [Vercel AI SDK](https://ai-sdk.dev); set up like PickIt: OpenAI, Anthropic, Gemini or any OpenAI-compatible API, chat and embedding models configured separately): once a message's files are saved, its text and up to 4 images go to the chat model once, which returns a category (from your list, or a new one), tags, a one-line summary, the text in the images, and key facts (amounts, dates, phone numbers, emails, links, addresses, order / tracking numbers, names). Runs on the same queue as downloads, with retries and a daily limit; the backlog can be analyzed from Settings → AI, and category and tags can be edited by hand
- **Search**: keywords over the text, image text, summaries, tags and categories (SQLite FTS5 with the trigram tokenizer, which suits Chinese; LIKE for 1–2 character queries), plus search by meaning when an embedding model is set up (vectors in D1, compact 512-dim sketches as in PickIt, so it stays within the free plan's CPU limit). Results are fused and respect the filters; MCP's `search_messages` uses it too
- **Download as ZIP**: from the Messages page (with its filters: time, platforms, bots, chat types and specific conversations, all multi-select) or Settings → Data (a whole platform). Pick dates, file types and folder layout (by bot and month, by chat, or flat), optionally with `messages.json`; a `report.txt` lists files that aren't saved or failed. The ZIP is built in the browser (a Worker's CPU limit can't checksum gigabytes): Chrome and Edge stream it straight to disk at any size, other browsers download it in parts of up to 500 MB. Files are fetched three at a time with retries, and failed ones can be fetched again afterwards
- **Credential check**: each bot has a "Test credentials" button (also in its form) that asks the platform directly; for QQ that is the official AppAccessToken endpoint, and QQ's own error message is shown
- **Trash**: deleting a message moves it to the trash with its files (undo right away, or restore later from the Trash page); deleting it forever there, emptying the trash, or the trash retention setting (30 days by default) removes the files from R2 too
- **Retention**: Settings → Data & export sets how long the event log, failed download records and the trash are kept (presets or a custom number of days, or forever), with their record count and size
- **API token**: `Authorization: Bearer <token>` lets scripts read the API, e.g. to back up messages and files
- **MCP**: AI assistants such as Claude connect to `/api/mcp` (Streamable HTTP, API token) to search messages, look at saved images, list bots, and check or retry failed downloads
- **Filters and live refresh**: lists filter like PickIt (one-of selects, searchable multi-selects, removable chips); the task queue and event log refresh live every 5 seconds or on demand
- **Sign-in**: Google / GitHub via [Better Auth](https://better-auth.com), restricted to an email allowlist that can be edited in Settings (no passwords)
- **Languages**: Chinese, English and Japanese interface; **Theme**: System / Light / Dark

## How it works

```
QQ ──webhook──▶ Worker ──verify signature──▶ D1 (message + attachment rows, status "pending")
                                   │
                                   └──enqueue──▶ Queue "stash-media" ──▶ consumer ──stream──▶ R2
                                                     │ retry with backoff        │
                                                     └──▶ DLQ (mark failed)       └──▶ D1 status "stored"
Cron every 10 min: re-queue lost or interrupted downloads
```

| Path | Role |
| --- | --- |
| `apps/api/src/platforms/` | One adapter per platform (verify + parse); `qq/` for now |
| `apps/api/src/ingest.ts` | Saves messages and attachment rows, then enqueues |
| `apps/api/src/media/` | Download to R2, retry policy, queue consumer, sweep |
| `apps/web` | React app (served by the same Worker) |
| `packages/shared` | Types and translations shared by web and API |

## Tech stack

- **API**: [Hono](https://hono.dev) on Cloudflare Workers, D1 (SQLite), R2, Queues, Cron Triggers
- **Web**: React 19, React Router, TanStack Query, Tailwind CSS 4, [Base UI](https://base-ui.com) components (coss ui)
- **i18n**: [Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)
- Monorepo with pnpm workspaces

## Local development

Requirements: Node.js 24+, pnpm 11+.

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # local secrets (git-ignored)
pnpm db:migrate   # apply migrations to the local D1 database
pnpm dev          # web on http://localhost:5173, API on :8787
```

`wrangler dev` simulates D1, R2 and Queues locally. `.dev.vars.example` sets `DEV_AUTH_BYPASS=1`, which skips sign-in while `BETTER_AUTH_URL` is localhost. QQ can't reach localhost; to try real messages, deploy, or expose port 8787 with a tunnel (e.g. `cloudflared tunnel --url http://localhost:8787`) and use that URL.

### Translations

UI text lives in `packages/shared/messages/{zh,en,ja}.json`. After editing, run `pnpm --filter @stash/shared i18n`.

### Tests

```bash
pnpm typecheck
pnpm test
```

## Deploy to Cloudflare

```bash
cd apps/api
npx wrangler d1 create stash-db              # paste the id into wrangler.jsonc
npx wrangler r2 bucket create stash-media
npx wrangler queues create stash-media
npx wrangler queues create stash-media-dlq
npx wrangler secret put BETTER_AUTH_SECRET   # any long random string
npx wrangler secret put ALLOWED_EMAILS       # you@example.com
cd ../..
pnpm db:migrate:remote
pnpm deploy
```

Set `BETTER_AUTH_URL` in `wrangler.jsonc` `vars` to your public origin (and uncomment `routes` for a custom domain). Webhook URLs shown in Settings start with it; QQ requires HTTPS on port 443, which a Workers domain or custom domain provides.

### Sign-in (Google / GitHub)

Create OAuth apps with the callback `https://<your-domain>/api/auth/callback/google` (or `/github`) and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and/or `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` with `wrangler secret put`.

### Connect a QQ bot

1. Create a bot at [q.qq.com](https://q.qq.com) and copy its **AppID** and **AppSecret**.
2. In Stash, open Settings → Bots → Add bot and paste them. Copy the webhook URL it shows.
3. In the QQ console, under Development → Callback, paste the webhook URL (QQ verifies it right away) and subscribe to message events such as `C2C_MESSAGE_CREATE` (direct messages) and `GROUP_AT_MESSAGE_CREATE`.
4. Add the bot as a friend and send it a photo. While the bot is in sandbox mode, add yourself as a test member first.

### Free plan limits

Workers 100,000 requests/day, D1 100,000 rows written/day and 5 GB, R2 10 GB storage (then about $0.015/GB-month), Queues 10,000 operations/day (about 3 per file). Storage is usually the first limit you reach.

### Continuous deployment

`.github/workflows/ci.yml` typechecks, tests and builds every push. On `main` it also applies D1 migrations and deploys; add the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.
