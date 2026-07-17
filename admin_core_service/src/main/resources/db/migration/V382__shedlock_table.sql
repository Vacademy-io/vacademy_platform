-- V382: ShedLock lock table.
--
-- admin_core_service runs with 4 replicas, and Spring @Scheduled has no leader
-- election — so every scheduled job (the Meta lead poller, token refresh, health
-- monitor, ...) fires on ALL 4 pods each tick. That means 4x redundant work and,
-- for the poller, 4 concurrent ingests of the same lead (amplifying the
-- check-then-insert dedup race). ShedLock uses this single shared row-per-job to
-- ensure only ONE pod runs a given @SchedulerLock-annotated job per schedule.
-- This is the standard ShedLock JdbcTemplate schema (do not rename the columns).
CREATE TABLE IF NOT EXISTS shedlock (
    name       VARCHAR(64)  NOT NULL,
    lock_until TIMESTAMP    NOT NULL,
    locked_at  TIMESTAMP    NOT NULL,
    locked_by  VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
