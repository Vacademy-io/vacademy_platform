-- Engagement Engine — Phase 2: proactive AUTONOMOUS sends (the engine sends outreach itself,
-- behind a graduation ramp + kill switch + holdout + enforced credits).

-- Kill switch: an emergency stop for AUTONOMOUS sending only. When true the engine keeps
-- deciding and drafting (copilot tasks) but never auto-sends — distinct from PAUSED (which stops
-- the whole engine). Per-engine so one misbehaving engine can be silenced without touching others.
ALTER TABLE engagement_engine
    ADD COLUMN IF NOT EXISTS auto_send_killed BOOLEAN NOT NULL DEFAULT FALSE;

-- Graduation ramp: an engine's first N proactive drafts stay copilot (a human sends them), and
-- only after N human-approved sends does it graduate to autonomous. NULL = use the institute/global
-- default (engagement.autonomy.first-n). A per-engine override lets a trusted engine graduate faster
-- or a sensitive one slower.
ALTER TABLE engagement_engine
    ADD COLUMN IF NOT EXISTS first_n INT;

-- Holdout cohort: a percentage (0..100) of the audience that is enrolled but NEVER messaged, so
-- lift can be measured against the treated cohort. 0 = no holdout.
ALTER TABLE engagement_engine
    ADD COLUMN IF NOT EXISTS holdout_pct INT NOT NULL DEFAULT 0;

-- The per-member holdout flag, assigned deterministically at enrollment (a stable hash of the
-- subject, so re-reconciles never flip a member between cohorts). A holdout member is decided-around:
-- skipped before the LLM, never messaged.
ALTER TABLE engagement_member
    ADD COLUMN IF NOT EXISTS is_holdout BOOLEAN NOT NULL DEFAULT FALSE;

-- At-least-once metering: a successful credit deduction STAMPS the action; a SENT autonomous send
-- left unstamped (the deduct HTTP call to ai_service was lost after the message went out) is
-- re-charged by the dispatch job's reconciliation pass — idempotency_key=action_id makes the retry
-- charge exactly once. Without this a lost deduct would silently leak revenue (the V378 lesson).
ALTER TABLE engagement_action
    ADD COLUMN IF NOT EXISTS credits_billed_at TIMESTAMP;

-- Per-proactive-send credit rate. INSERT-only (no ALTER of the shared table), mirroring V378's
-- call-billing precedent. Charged via CreditClient.deductPrecomputed(request_type='engagement_message',
-- idempotency_key=action_id) which carries precomputed_credits + no usage_log_id, so the
-- ai_token_usage CHECK trap is avoided by design. The CHARGED amount lives in config
-- (engagement.credits.per-message) and MUST be kept in sync with token_rate here.
INSERT INTO credit_pricing (request_type, base_cost, token_rate, minimum_charge, unit_type, description, is_active)
VALUES ('engagement_message', 0, 1.0, 0, 'messages',
        'One proactive Engagement-Engine message (WhatsApp/email/in-app) sent autonomously', TRUE)
ON CONFLICT (request_type) DO NOTHING;
