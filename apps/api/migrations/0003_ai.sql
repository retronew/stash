-- AI analysis of messages (see src/analysis/): category, tags, a summary,
-- text read from the images, and key fields. Also editable by hand.
ALTER TABLE messages ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE messages ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN ocr_text TEXT NOT NULL DEFAULT '';
-- JSON MessageFields (amounts, dates, phones, …).
ALTER TABLE messages ADD COLUMN fields TEXT NOT NULL DEFAULT '{}';

-- '' never analyzed · pending (queued) · running · done · failed · skipped
ALTER TABLE messages ADD COLUMN ai_status TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN ai_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN ai_error TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN ai_next_retry_at INTEGER;
ALTER TABLE messages ADD COLUMN ai_updated_at INTEGER;
-- When the last successful analysis ran (counts toward the daily limit).
ALTER TABLE messages ADD COLUMN ai_at INTEGER;

-- Semantic search, as in PickIt: the full vector and a 512-dim int8 sketch.
ALTER TABLE messages ADD COLUMN embedding BLOB;
ALTER TABLE messages ADD COLUMN vec BLOB;
ALTER TABLE messages ADD COLUMN embedding_model TEXT;

CREATE INDEX messages_ai_status_idx ON messages (ai_status, ai_updated_at);
CREATE INDEX messages_ai_at_idx ON messages (ai_at);
CREATE INDEX messages_category_idx ON messages (category);

-- Keyword search. The trigram tokenizer matches any 3+ character substring,
-- which suits Chinese (no spaces between words); shorter queries use LIKE.
CREATE VIRTUAL TABLE messages_fts USING fts5(
  text, sender_name, summary, ocr_text, tags, category,
  content = 'messages', content_rowid = 'id', tokenize = 'trigram'
);

CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts (rowid, text, sender_name, summary, ocr_text, tags, category)
  VALUES (new.id, new.text, new.sender_name, new.summary, new.ocr_text, new.tags, new.category);
END;

CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts (messages_fts, rowid, text, sender_name, summary, ocr_text, tags, category)
  VALUES ('delete', old.id, old.text, old.sender_name, old.summary, old.ocr_text, old.tags, old.category);
END;

CREATE TRIGGER messages_fts_update AFTER UPDATE OF text, sender_name, summary, ocr_text, tags, category ON messages BEGIN
  INSERT INTO messages_fts (messages_fts, rowid, text, sender_name, summary, ocr_text, tags, category)
  VALUES ('delete', old.id, old.text, old.sender_name, old.summary, old.ocr_text, old.tags, old.category);
  INSERT INTO messages_fts (rowid, text, sender_name, summary, ocr_text, tags, category)
  VALUES (new.id, new.text, new.sender_name, new.summary, new.ocr_text, new.tags, new.category);
END;

INSERT INTO messages_fts (messages_fts) VALUES ('rebuild');
