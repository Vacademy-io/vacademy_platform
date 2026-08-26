-- V468: real-user latency, aggregated per minute, for the "is it us or their
-- internet?" view on the health portal.
--
-- WHAT THIS IS NOT: a row per request. admin_core serves a very large number of
-- requests and its database is a 4-core box that has already been OOM-killed once by
-- an analytics query (2026-08-03). Telemetry about slowness must not itself become a
-- source of slowness. So the browser aggregates per minute, only a sample of sessions
-- report at all, and each pod batches one INSERT per flush.
--
-- WHY HISTOGRAM BUCKETS INSTEAD OF A STORED p95:
-- admin_core runs 4 replicas, each holding its own in-memory buffer, so the same
-- (minute, institute, route) arrives as up to 4 separate rows. Percentiles cannot be
-- averaged -- avg(p95_a, p95_b) is not the p95 of the combined set, and the error is
-- not small. Bucket COUNTS can simply be summed, and an approximate percentile read
-- back off the summed histogram. Storing p95 per row would produce a number that
-- looks precise and is quietly wrong.
--
-- Bucket boundaries are fixed and must never be reordered or reinterpreted, or old
-- rows silently change meaning. Index i counts samples with duration <= BOUNDS[i]:
--
--     [0] <=50ms   [1] <=100ms  [2] <=250ms  [3] <=500ms   [4] <=1000ms
--     [5] <=2000ms [6] <=5000ms [7] <=10000ms [8] everything slower
--
-- The array is therefore always length 9. If a boundary ever needs to change, add a
-- new column rather than redefining these -- mixing two boundary sets in one column
-- produces charts that are wrong in a way nobody can see.

CREATE TABLE IF NOT EXISTS perf_rum_minute (
    id                  BIGSERIAL PRIMARY KEY,

    -- Truncated to the minute, in UTC. The JVM is required to run in UTC
    -- (see admin-core-jvm-ist-date-serialization); do not localise this.
    bucket_start        TIMESTAMP     NOT NULL,

    -- VARCHAR to match institutes.id, which is varchar(255), NOT a uuid. Joining a
    -- uuid column against it silently returns nothing.
    -- Nullable: a report can arrive before an institute is resolvable.
    institute_id        VARCHAR(255),

    -- 'server'  -- our processing time, from the Server-Timing response header.
    -- 'network' -- round trip of the /v1/perf/ping baseline, which does no server
    --              work, so it measures the user's connection rather than us.
    metric              VARCHAR(32)   NOT NULL,

    -- Templated route ('/admin-core-service/v1/users/:id'), never a raw URL --
    -- raw URLs carry ids and sometimes emails, and would explode cardinality.
    -- The literal '(ping)' is reserved for metric = 'network'.
    route_key           VARCHAR(255)  NOT NULL,

    sample_count        INTEGER       NOT NULL,

    -- Responses that carried no Server-Timing header. Counted rather than folded in
    -- as 0ms, which would bias the histogram toward "fast" and make us look better
    -- than we are. Absence means "could not annotate", never "was fast".
    unannotated_count   INTEGER       NOT NULL DEFAULT 0,

    -- Always length 9. See the boundary table above.
    buckets             INTEGER[]     NOT NULL,

    created_at          TIMESTAMP     NOT NULL DEFAULT now()
);

-- The dashboard always filters by time first, newest first.
CREATE INDEX IF NOT EXISTS idx_perf_rum_bucket_start
    ON perf_rum_minute (bucket_start DESC);

-- Per-institute drill-down ("which institute is having a bad time right now").
CREATE INDEX IF NOT EXISTS idx_perf_rum_institute_bucket
    ON perf_rum_minute (institute_id, bucket_start DESC);
