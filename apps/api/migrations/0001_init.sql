-- Key/value settings (allowed emails, locale).
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Better Auth tables (Google / GitHub sign-in), same as Better Auth 1.7.5's
-- getMigrations().compileMigrations() for the config in src/auth.ts.
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null);
create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);
create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);
create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");

-- A bot on a chat platform. Its webhook is /api/webhooks/<platform>/<webhook_key>.
-- ("account" is taken by Better Auth, hence bot_accounts.)
CREATE TABLE bot_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  app_id TEXT NOT NULL DEFAULT '',
  app_secret TEXT NOT NULL DEFAULT '',
  webhook_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_event_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (platform, webhook_key)
);

-- One received message. (account_id, external_id) makes webhook redelivery a no-op.
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES bot_accounts (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  chat_type TEXT NOT NULL,
  chat_id TEXT NOT NULL DEFAULT '',
  sender_id TEXT NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  -- The platform's event payload, kept for debugging and re-parsing.
  raw TEXT NOT NULL DEFAULT '',
  sent_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  UNIQUE (account_id, external_id)
);
CREATE INDEX messages_sent_idx ON messages (sent_at DESC, id DESC);
CREATE INDEX messages_account_idx ON messages (account_id, sent_at DESC);

-- A file on a message. status: pending → downloading → stored | failed
-- (see media/consumer.ts); source_url is the platform's (often short-lived) link.
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  kind TEXT NOT NULL,
  source_url TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  size INTEGER,
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  r2_key TEXT,
  stored_size INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  -- When a queued retry is due; the sweep leaves the row alone until then.
  next_retry_at INTEGER,
  stored_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (message_id, idx)
);
CREATE INDEX attachments_status_idx ON attachments (status, updated_at);
