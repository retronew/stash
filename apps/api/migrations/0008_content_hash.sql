-- SHA-256 of a stored file (hex), to recognize the same file sent again; see
-- media/dedupe.ts. NULL = not hashed yet (the "hashes" task fills these in),
-- '' = couldn't be hashed (file missing).
ALTER TABLE attachments ADD COLUMN content_hash TEXT;
CREATE INDEX attachments_content_hash ON attachments (content_hash) WHERE content_hash IS NOT NULL AND content_hash != '';
CREATE INDEX attachments_hash_todo ON attachments (id) WHERE status = 'stored' AND content_hash IS NULL;
