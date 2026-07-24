-- The idempotency index from V367 covered soft-DELETED rows too, so unlinking a
-- recording from a chapter and re-adding it violated the constraint. Exclude
-- DELETED rows: only one ACTIVE link per (schedule, recording, chapter).
DROP INDEX IF EXISTS uq_live_session_content_links_schedule_recording_chapter;

CREATE UNIQUE INDEX IF NOT EXISTS uq_live_session_content_links_schedule_recording_chapter
    ON live_session_content_links (schedule_id, recording_id, chapter_id)
    WHERE recording_id IS NOT NULL AND status <> 'DELETED';
