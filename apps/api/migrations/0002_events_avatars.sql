-- Every webhook call, whether or not it became a message. outcome:
--   stored     a new message was saved          (hit)
--   duplicate  a redelivery of a saved message   (hit)
--   ignored    a valid event Stash doesn't keep (e.g. a friend was added)
--   validation the platform checking the callback URL
--   rejected   bad signature, malformed body, unknown or disabled bot
--   error      Stash failed to save it (the platform retries)
-- Pruned after 30 days by the cron sweep; the messages themselves stay.
CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT REFERENCES bot_accounts (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  message_id INTEGER REFERENCES messages (id) ON DELETE SET NULL,
  -- The request body, cut to 16 KB.
  raw TEXT NOT NULL DEFAULT '',
  received_at INTEGER NOT NULL
);
CREATE INDEX webhook_events_received_idx ON webhook_events (received_at DESC, id DESC);
CREATE INDEX webhook_events_account_idx ON webhook_events (account_id, id DESC);

-- A bot's own picture in R2 (avatars/<id>); NULL = the platform icon.
-- avatar_updated_at busts browser caches when it changes.
ALTER TABLE bot_accounts ADD COLUMN avatar_key TEXT;
ALTER TABLE bot_accounts ADD COLUMN avatar_updated_at INTEGER;
