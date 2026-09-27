# Stash

**English** | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

**Photos and messages from your chats, kept in one place.** A self-hosted, single-user inbox that receives messages from chat-platform bots and saves them, with every image and file downloaded into your own storage. It runs entirely on Cloudflare Workers + D1 + R2 + Queues and fits the free plan for personal use. QQ is supported first; the platform layer is built so Telegram and others can be added.

## Features

- **QQ bots**: add a bot on the QQ Open Platform, paste its AppID / AppSecret into Settings and the webhook URL Stash shows into the QQ console. Stash answers the callback URL check (op 13) and verifies the Ed25519 signature of every event. Direct messages, group @-messages and channel messages are stored; a redelivered event is stored once
- **Reliable file saving**: the webhook only writes the message to D1 and queues its attachments, so QQ gets its answer quickly. A queue consumer streams each file into R2 without buffering it, so files of tens or hundreds of MB fit (known length: one streamed PUT; unknown length or over 5 GB: multipart upload in 10 MB parts), and checks the stored size against `Content-Length`
- **Retries**: network errors, timeouts, truncated downloads, 408 / 429 / 5xx are retried 9 times, backing off from 30 seconds to 2 hours (about 5 hours in total, within the free plan's 24-hour queue retention). Expired links (other 4xx) fail at once. A dead-letter queue catches consumers that crash, and a sweep every 10 minutes re-queues attachments whose queue message was lost or whose download died. Failed files can be retried one by one or all at once from the web app
- **Web app**: a feed of messages with image thumbnails, a full-size viewer (images, video, audio) and downloads; filter by bot, "with files" or "failed"; download queue stats
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
