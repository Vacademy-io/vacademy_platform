-- Indexes that make a username rename cheap, WITHOUT taxing the hot write path.
--
-- A learner's username is denormalized into four tables in this database, and
-- until now nothing propagated a rename into them -- the copies just went
-- stale. The rename fan-out (InternalUserCredentialController) issues one bulk
-- UPDATE per table, so each predicate needs an index or the "cheap" rename
-- degrades into a seq scan.
--
-- Coverage before this migration:
--   assessment_user_registration  -> idx_aur_username_institute_created leads
--                                    with username, already covers it (V34).
--   assessment_user_access        -> no index on username. Added below; the
--                                    table is small and almost never written.
--   live_session_participant      -> UNIQUE (session_id, username); username is
--                                    the SECOND column, so not a usable prefix
--                                    for a username-only predicate. Added below.
--                                    One row per learner per session, so the
--                                    added write cost is negligible.
--   live_session_response         -> deliberately NOT indexed on username.
--
-- Why live_session_response gets no index: it is the fastest-growing, most
-- write-heavy table here (one row per learner per slide per attempt, written
-- continuously while classes run). A btree on username would be maintained on
-- every one of those inserts forever, to speed up an operation that happens a
-- handful of times a day. That trade is backwards.
--
-- Instead the rename scopes that table by session_id, which IS the leading
-- column of the existing idx_live_session_response_session_slide (V6):
--
--   WHERE username = :old
--     AND session_id IN (SELECT session_id FROM live_session_participant
--                         WHERE username = :old)
--
-- so it index-scans the handful of sessions the learner actually attended
-- rather than scanning the whole table -- at zero ongoing insert cost.
--
-- CONCURRENTLY because these tables take writes while classes are running; a
-- plain build holds a SHARE lock and stalls them. Flyway runs an
-- all-non-transactional migration outside a transaction, so this file contains
-- ONLY concurrent statements (same split rationale as admin_core V403/V404,
-- and the same pattern already used by V25 in this service).
--
-- Note on IF NOT EXISTS + CONCURRENTLY: a failed concurrent build leaves an
-- INVALID index behind that IF NOT EXISTS will silently skip on re-run. If a
-- rename ever looks slow, check pg_index.indisvalid for these two.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aua_username
    ON public.assessment_user_access (username);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_session_participant_username
    ON public.live_session_participant (username);
