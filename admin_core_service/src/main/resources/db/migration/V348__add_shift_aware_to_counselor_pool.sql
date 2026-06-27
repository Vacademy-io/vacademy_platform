-- Opt-in flag so a ROUND_ROBIN pool can additionally gate its rotation to
-- counsellors who are on shift right now (reusing the same shift schedule that
-- TIME_BASED pools use). When false (default, and for all existing pools),
-- ROUND_ROBIN behaves exactly as before: every member is a candidate.
ALTER TABLE counselor_pool
    ADD COLUMN shift_aware BOOLEAN NOT NULL DEFAULT FALSE;
