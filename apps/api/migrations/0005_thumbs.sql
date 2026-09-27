-- Thumbnails (480px, lists) and previews (1280px, AI) of stored images; see media/thumbs.ts.
-- '' = not made yet (the sweep picks these up), done, failed, skipped.
ALTER TABLE attachments ADD COLUMN thumb_status TEXT NOT NULL DEFAULT '';
ALTER TABLE attachments ADD COLUMN thumb_error TEXT NOT NULL DEFAULT '';
CREATE INDEX attachments_thumb_todo ON attachments (id) WHERE kind = 'image' AND status = 'stored' AND thumb_status = '';
