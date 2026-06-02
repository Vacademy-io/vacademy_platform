-- V302: provider-account pinning + plain meeting passcode columns on
-- session_schedules.
--
-- These mirror the BBB pattern (which uses a single provider-specific
-- bbb_server_id column for pool-server pinning) and complement the existing
-- generic provider_* columns (provider_meeting_id, provider_host_url,
-- provider_recordings_json) so any multi-account live-session provider —
-- Zoom today, others later — can reuse them without provider-specific schema
-- changes.
--
-- Columns:
--   provider_account_id  — FK-style reference to
--                          institute_live_session_provider_mapping.id (the
--                          provider-account row this meeting was created
--                          under). Pinned at create-meeting time; used by
--                          join/SDK-signature, webhook and recording-poller
--                          paths to resolve the right credentials.
--   provider_passcode    — plain meeting passcode returned by the provider.
--                          Needed by embedded SDKs (Zoom Web SDK
--                          client.join({password})) that can't reuse the
--                          encrypted pwd token embedded in the join URL.
--
-- Per-recording metadata (expiry, storage source) is NOT added here — it
-- belongs inside provider_recordings_json per recording entry, matching the
-- BBB pattern where fileId presence inside the JSON indicates "synced to S3".

ALTER TABLE session_schedules
    ADD COLUMN IF NOT EXISTS provider_account_id  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_passcode    VARCHAR(255);
