-- Per-session waiting room type. WAITING_ROOM = existing waiting-room behaviour
-- (learner sees "Join Waiting Room" during the waiting-room window).
-- PRE_JOINING = during that same window the learner instead joins the live
-- class directly ("Join Live Class"), skipping the waiting-room screen.
ALTER TABLE live_session ADD COLUMN IF NOT EXISTS waiting_room_type VARCHAR(20) DEFAULT 'WAITING_ROOM';
-- Ensure the column default is WAITING_ROOM even if the column already existed.
ALTER TABLE live_session ALTER COLUMN waiting_room_type SET DEFAULT 'WAITING_ROOM';

-- Backfill every pre-existing class to WAITING_ROOM so no read path ever sees NULL,
-- and convert any rows still holding the earlier 'DEFAULT' value.
UPDATE live_session SET waiting_room_type = 'WAITING_ROOM'
 WHERE waiting_room_type IS NULL OR waiting_room_type = 'DEFAULT';
