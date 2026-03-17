-- ================================================================================================
-- V86: Performance Optimization Indexes for Live Sessions
-- ================================================================================================
-- Purpose: Optimize /get-sessions/learner/live-and-upcoming endpoint
-- Expected Performance Gain: 70-85% reduction in query execution time
-- 
-- These indexes support the findUpcomingSessionsForUserAndBatch query which combines
-- both batch and user session lookups in a single optimized query.
-- ================================================================================================

-- ================================================================================================
-- 1. OPTIMIZED INDEX FOR LIVE_SESSION_PARTICIPANTS
-- ================================================================================================
-- Covers: source_type, source_id lookups and session_id joins
-- Use case: Quickly find all sessions for a specific user or batch
-- ================================================================================================

CREATE INDEX IF NOT EXISTS idx_live_session_participants_source_optimized
ON live_session_participants (source_type, source_id, session_id);

-- Partial indexes for specific source types (even better performance)
CREATE INDEX IF NOT EXISTS idx_live_session_participants_user_optimized
ON live_session_participants (source_id, session_id)
WHERE source_type = 'USER';

CREATE INDEX IF NOT EXISTS idx_live_session_participants_batch_optimized
ON live_session_participants (source_id, session_id)
WHERE source_type = 'BATCH';

-- ================================================================================================
-- 2. OPTIMIZED INDEX FOR SESSION_SCHEDULES
-- ================================================================================================
-- Covers: meeting_date filtering, status checks, and session joins
-- Use case: Efficiently filter upcoming sessions by date
-- ================================================================================================

CREATE INDEX IF NOT EXISTS idx_session_schedules_upcoming_optimized
ON session_schedules (meeting_date, start_time, session_id)
WHERE status != 'DELETED';

-- ================================================================================================
-- 3. COMPOSITE INDEX FOR LIVE_SESSION
-- ================================================================================================
-- Optimizes status filtering and id lookups
-- ================================================================================================

CREATE INDEX IF NOT EXISTS idx_live_session_status_id_optimized
ON live_session (status, id)
WHERE status IN ('DRAFT', 'LIVE');
