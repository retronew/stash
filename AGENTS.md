# AGENTS.md

Guidance for AI coding agents working in this repository.

## Modularity and maintainability

When implementing anything, keep the code modular. Don't pile a feature into one file.

- **One responsibility per file.** A page wires things together; it doesn't hold
  all the logic and markup itself. When a component grows past roughly 200 lines
  or mixes several concerns, split it.
- **Separate logic from UI.** Put state, data fetching and side effects in hooks
  (`apps/web/src/hooks/useXxx.ts`), and keep components mostly presentational.
  `MessageDetailDialog` + `useMessages` is the pattern to follow.
- **Split before you need to reuse.** If a piece of UI or logic could plausibly be
  used elsewhere later (a button with copied state, a skeleton, a formatter, a
  fetch helper), extract it now rather than copy-pasting it later:
  - Generic UI goes in `apps/web/src/components/` (e.g. `CopyButton`, `Confirm`).
  - Feature UI goes in a feature folder (`components/messages/`, `components/settings/…`).
  - Pure helpers go in `apps/web/src/lib/`.
  - Types, schemas and i18n messages shared by web and API go in `packages/shared`.
  - API route handlers stay thin; business logic lives in its own modules.
- **Reuse before writing.** Check `components/ui/`, `components/`, `hooks/` and
  `lib/` for an existing piece first, e.g. the skeletons in
  `components/settings/skeletons.tsx` or `useDelayedFlag`.
- **Keep the interfaces small.** Components get explicit props and hooks return
  plain objects. Avoid hidden coupling through globals.
- **Match what's already there.** Follow the naming, folder layout, import
  aliases (`#components/…`, `#lib/…`, `#hooks/…`) and comment density of the
  surrounding code.

## Other conventions

- Write the product name as "Stash" in UI and docs.
- UI text goes through Paraglide messages (`packages/shared/messages/{zh,en,ja}.json`).
  Add every new key to all three files, then run `pnpm --filter @stash/shared i18n`.
- When behavior or setup changes, update all three READMEs (`README.md`,
  `README.zh-CN.md`, `README.ja.md`).
- Make it work on mobile as well as desktop.

## Platforms

- Each chat platform lives in `apps/api/src/platforms/<platform>/` and implements
  `PlatformAdapter` (`platforms/types.ts`): verify the webhook, turn events into
  `IncomingMessage`s. Storage, queueing and the UI never look at platform payloads.
- Attachments are never downloaded inside the webhook request. The webhook stores
  rows and enqueues; `media/consumer.ts` downloads into R2 with retries.
