-- Minimum-attendance rule: a learner counts as PRESENT only if they were
-- actually in the class for at least N% of its scheduled length, instead of
-- being marked present the moment they click Join.
--
-- A learner missing from the provider's roster counts as zero minutes, so
-- "clicked Join but never entered" falls out of the same comparison. Measured
-- on prod, of 290 such learners over 45 days, 41% never even requested a join
-- URL and 67% show a ~12-minute retry-then-give-up pattern — all of them
-- currently recorded PRESENT.
--
-- Vacademy Meet (roster from the analytics callback) and Zoom (roster from the
-- past-meeting report). Google Meet returns participants with no email so they
-- cannot be tied back to a learner; those classes are never evaluated.
--
-- Seeded onto each session from the institute's
-- LIVE_SESSION_SETTING.defaultAttendanceCriteria at scheduling time, not read
-- from that setting at evaluation time. A class is judged by the rule it was
-- created under, so switching the setting on never retroactively re-decides
-- classes already scheduled or already taught. NULL = disabled = today's
-- behaviour, so no institute is affected until it opts in.
ALTER TABLE live_session
    ADD COLUMN IF NOT EXISTS attendance_criteria_json TEXT;

-- Audit trail for every evaluation. Attendance is disputed data: this records
-- why a learner was marked absent - the verdict, minutes attended, the
-- scheduled length used as denominator, and the threshold applied.
ALTER TABLE live_session_logs
    ADD COLUMN IF NOT EXISTS attendance_evaluation_json TEXT;

COMMENT ON COLUMN live_session.attendance_criteria_json IS
    'Per-session minimum-attendance rule: {enabled, minDurationPercent}. Copied from the institute LIVE_SESSION_SETTING.defaultAttendanceCriteria when the class is scheduled. NULL or disabled = the join click alone decides attendance.';

COMMENT ON COLUMN live_session_logs.attendance_evaluation_json IS
    'Audit of the attendance-criteria evaluation: verdict, reason (MET_THRESHOLD/BELOW_THRESHOLD/NO_SHOW/NO_DURATION_DATA), attendedMinutes, scheduledMinutes, requiredMinutes, thresholdPercent, attendedPercent, previousStatus, evaluatedAt.';
