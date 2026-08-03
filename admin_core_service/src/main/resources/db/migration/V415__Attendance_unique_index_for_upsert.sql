-- Attendance marking used read-check-then-save, so concurrent requests from a
-- class joining at once created duplicate ATTENDANCE_RECORDED rows (2,487 excess
-- rows across 1,622 schedule+user pairs at the time of writing). Reads pick the
-- earliest row (ORDER BY created_at ASC, first), so keep that one and drop the rest.
DELETE FROM live_session_logs del
USING live_session_logs keep
WHERE del.log_type = 'ATTENDANCE_RECORDED'
  AND keep.log_type = 'ATTENDANCE_RECORDED'
  AND del.schedule_id = keep.schedule_id
  AND del.user_source_id = keep.user_source_id
  AND del.id <> keep.id
  AND (keep.created_at < del.created_at
       OR (keep.created_at = del.created_at AND keep.id < del.id));

-- Partial unique index scoped to attendance rows only: other log types
-- (FEEDBACK_SUBMITTED etc.) may legitimately repeat per schedule+user.
-- This is the conflict target for the INSERT ... ON CONFLICT upsert in
-- LiveSessionLogsRepository.upsertAttendance.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lsl_attendance_schedule_user
    ON live_session_logs (schedule_id, user_source_id)
    WHERE log_type = 'ATTENDANCE_RECORDED';
