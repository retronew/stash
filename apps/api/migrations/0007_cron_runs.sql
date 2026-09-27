-- Scheduled task runs, for Settings → Scheduled tasks (as in PickIt). Runs
-- that did nothing aren't logged (every 10 minutes adds up); failures and
-- manual runs always are. Kept 30 days. When the trigger last fired is in
-- settings (cron_tick:<expression>).
CREATE TABLE cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'cron',
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  error TEXT
);
CREATE INDEX cron_runs_task ON cron_runs (task, started_at);
CREATE INDEX cron_runs_started ON cron_runs (started_at);
