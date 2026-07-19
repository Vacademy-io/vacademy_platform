-- V386's CREATE TABLE IF NOT EXISTS engagement_member listed consecutive_failures, but on the
-- deployed environment the table already existed (from a pre-split-column version, when failure and
-- no-op counters were one column), so IF NOT EXISTS skipped the whole body and the column was never
-- added — while V386 still recorded success. The EngagementMember entity maps consecutive_failures,
-- so findDueMembers (SELECT * -> entity) threw "column consecutive_failures was not found" on EVERY
-- sweep, and no engagement decision was ever produced in prod. This adds the column idempotently:
-- a no-op on any environment where V386's CREATE TABLE did materialize it, a repair everywhere else.
ALTER TABLE engagement_member
    ADD COLUMN IF NOT EXISTS consecutive_failures SMALLINT NOT NULL DEFAULT 0;
