-- Recycle bin: a deleted message keeps its rows and files until purged
-- (by hand, or by the "trash" retention setting).
ALTER TABLE messages ADD COLUMN deleted_at INTEGER;
CREATE INDEX messages_deleted_at ON messages (deleted_at) WHERE deleted_at IS NOT NULL;
