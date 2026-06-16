-- Partial indexes over live (non-deleted) chat messages. The keyset pagination + per-conversation
-- recent-sender lookups all filter on is_deleted = false, so these narrow, partial indexes keep the
-- hot path off tombstoned rows.

CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_seq_live
    ON chat_messages (conversation_id, seq) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_chat_msg_sender_recent
    ON chat_messages (conversation_id, sender_id, seq DESC) WHERE is_deleted = false;
