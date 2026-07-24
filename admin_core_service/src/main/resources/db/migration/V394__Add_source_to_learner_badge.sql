-- Distinguish how a learner_badge row was created:
--   MANUAL — an admin explicitly awarded it (the original, only, behaviour).
--   AUTO   — the learner's app synced a client-computed auto-unlock (streak, XP, …).
--
-- Auto-unlock badges are computed in the browser and were previously never persisted,
-- so leaderboards (which read learner_badge) could only ever show manual awards. The
-- /learner/v1/sync-unlocks endpoint now upserts AUTO rows so every learner's badges
-- appear on the in-app and public leaderboards. The column lets the award/revoke flow
-- keep manual awards distinct from synced ones (sync never overwrites a MANUAL row).
ALTER TABLE public.learner_badge
    ADD COLUMN IF NOT EXISTS source varchar(16) DEFAULT 'MANUAL' NOT NULL;
